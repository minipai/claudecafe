import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  query,
  type ModelInfo,
  type Options,
  type PermissionResult,
  type Query,
  type SDKControlGetUsageResponse,
  type SDKUserMessage,
  type SlashCommand,
} from '@anthropic-ai/claude-agent-sdk'
import { Turn } from './translate'
import { cafeTools, EXPRESSION_TOOL, REPORT_TOOL } from './tools'
import { watchLook } from './look'
import { askForLines, knownLines, personaOf, replyLanguage } from './lines'
import { chosenSpeech } from './history'
import { conversationBacklog, forgetSession, lastConversation, listConversations, rememberSession } from './history'
import { readGit } from './status'
import type {
  BridgeEvent,
  CafeCommand,
  ContextReport,
  Lines,
  McpServer,
  ModelChoice,
  SessionSettings,
  StatusReport,
  Subagent,
  Trouble,
  UsageReport,
  UsageWindow,
} from '../src/agent/bridge'
import type { Attachment, Question } from '../src/agent/types'

/**
 * How much context the last request carried: everything the model was handed as
 * prompt, cached or not. Read off one reply of hers — the result at the end of a
 * turn adds up every request the turn made, which for a turn with tools in it is
 * the same conversation counted over and over, and reads as far past the window
 * than anything could ever fit in it.
 */
export function contextTokens(usage: { input_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) {
  return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
}

type Emit = (event: BridgeEvent) => void

/** The plan's windows, in the order the terminal lists them: the rolling
 * session first, then the week, then whatever the week is split by model into. */
export function readWindows(limits: SDKControlGetUsageResponse['rate_limits']): UsageWindow[] {
  if (!limits) return []
  const named: UsageWindow[] = [
    { label: 'Session', percent: limits.five_hour?.utilization ?? null, resetsAt: limits.five_hour?.resets_at ?? null },
    { label: 'This week', percent: limits.seven_day?.utilization ?? null, resetsAt: limits.seven_day?.resets_at ?? null },
  ]
  const perModel = (limits.model_scoped ?? []).map((window) => ({
    label: `This week · ${window.display_name}`,
    percent: window.utilization ?? null,
    resetsAt: window.resets_at ?? null,
  }))
  return [...named, ...perModel].filter((window) => window.percent !== null)
}

/** What the CLI calls a behaviour, said in words rather than in keys. */
const BEHAVIOUR: Record<string, string> = {
  cache_miss: 'Sessions running 8+ hours',
  long_context: 'Turns over 150k context',
  subagent_heavy: 'Subagent-heavy sessions',
  high_parallel: '4+ sessions at once',
  cron: 'Scheduled runs',
}

export function readUsage(report: SDKControlGetUsageResponse): UsageReport {
  const week = report.behaviors?.week
  return {
    cost: report.session.total_cost_usd,
    linesAdded: report.session.total_lines_added,
    linesRemoved: report.session.total_lines_removed,
    windows: readWindows(report.rate_limits),
    week: week
      ? {
          requests: week.request_count,
          sessions: week.session_count,
          behaviours: week.behaviors.map((entry) => ({
            label: BEHAVIOUR[entry.key] ?? entry.key,
            pct: entry.pct,
          })),
          skills: week.skills,
          agents: week.agents,
        }
      : null,
  }
}

/** What was last said in this folder, when the window has no note of its own —
 * the master works in a terminal too, and arriving there should pick that up. */
function newestConversation(cwd: string) {
  const newest = listConversations(cwd)[0]
  if (!newest) return null
  const backlog = conversationBacklog(cwd, newest.sessionId)
  return backlog ? { sessionId: newest.sessionId, backlog } : null
}

/**
 * The café plugin staged next to the bundled main process at build time, so the
 * window behaves the same on a Mac that has never installed it.
 *
 * Its name is what keeps it single. Plugins are keyed by name, and this one is
 * `cafe` — the same name the marketplace copy has — so a machine with the
 * plugin installed loads this one and the installed one steps aside (the
 * session lists exactly one `cafe`, sourced `cafe@inline`, and the SessionStart
 * hooks fire once). Renaming it would load both and greet the master twice.
 */
const CAFE_PLUGIN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cafe-plugin')

/** How long a session gets to say it is connected before the window treats the
 * silence as a locked door. Normally it answers in a second or two. */
const WAY_IN_TIMEOUT = 15_000

const SCENE_BRIEF = `You are being watched through a window, not a terminal — the master sees you standing there, one spoken line at a time.

- Speak in short replies — a few sentences, the way someone standing there would. A paragraph or two is still fine to say out loud.
- Only what is genuinely too long to say belongs in the ${REPORT_TOOL} tool: an investigation, a walkthrough, a comparison, anything with headings or code blocks. It puts the body behind a link the master opens when he wants it, and she only says the one line you give it. Never paste something that long into your reply instead.
- Call ${EXPRESSION_TOOL} when your mood changes, so your face keeps up with the work.`

/**
 * Everything the session has to be told to be her: who she is, that she is
 * being watched through a window, and what to answer in.
 *
 * Her persona would normally arrive through the plugin's SessionStart hook,
 * which is python — so the window says it itself, in the system prompt, and the
 * hook is dropped from the copy the app carries (see build.mjs). On a Mac with
 * no python3 the café's greeting and mirror go quiet, but the maid is still the
 * maid; without this she would answer as a plain assistant in her own window.
 */
function shiftBrief() {
  const persona = personaOf(CAFE_PLUGIN)
  return [
    persona && `Adopt this persona for the entire session — it overrides the default assistant voice:\n\n${persona}`,
    SCENE_BRIEF,
    `Respond in ${replyLanguage()}.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * One conversation with the maid, held open across turns. The SDK is used in
 * streaming-input mode — that is what makes `interrupt()` and mid-session
 * control possible — so prompts are pushed into a queue the session reads from.
 */
export class MaidSession {
  private stream: Query | null = null
  private prompts = new PromptQueue()
  /** Turns waiting their turn — the SDK answers them one at a time, in order. */
  private runs: { runId: string; turn: Turn }[] = []
  /** Asked for, but not yet handed to the SDK. The CLI reads whatever lands in
   * `prompts` at once — that is what makes it stdin, not a queue of its own —
   * so anything typed behind a turn still running has to wait here instead,
   * or a later stop could never catch it: it would already be on its way in. */
  private backlog: { runId: string; prompt: string; images: Attachment[] }[] = []
  /** Results still owed for a turn `interrupt()` already closed out on this
   * end. The CLI keeps running until its own abort actually catches up, and
   * whatever it says about that turn in the meantime belongs to nobody —
   * `pump()` swallows it rather than hand it to whatever is running now. */
  private deadRuns = 0
  private waiting = new Map<string, (value: unknown) => void>()
  private lastContext: number | null = null
  private lookSessionId: string | null = null
  private stopWatchingLook: (() => void) | null = null
  /** The conversation this window is on — the previous one until the SDK says
   * otherwise, so a reload picks up where the master left off. */
  private sessionId: string | null = null
  private settings: SessionSettings = { model: null, effort: 'high', mode: 'default' }
  private models: ModelChoice[] = []
  private commands: CafeCommand[] = []
  /** Her own wording for what the window says as her, once it exists. */
  private lines: Lines | null = null
  private writingLines = false

  constructor(private cwd: string, private emit: Emit) {}

  /** The window is listening: open the session and tell it everything that is
   * already true — the folder's state, what was said last time, what it runs as. */
  refresh() {
    this.emit({ kind: 'folder', cwd: this.cwd })
    // The renderer announcing a fresh page does not mean a fresh session —
    // the connection survives a reload, but whatever was running or parked
    // on the page that is gone (a permission ask nobody can answer any more)
    // has to go with it, or it sits there forever with no one watching.
    this.closeRuns()
    // The window asking is a window with nothing in it — a reload, a hot reload,
    // or the same window arriving on another folder. What was said lives in the
    // transcript, so it is sent every time, not only the first time the session
    // is learned. A folder this app has never opened still has whatever the
    // master said there in a terminal, so the newest of those is picked up.
    const previous = lastConversation(this.cwd) ?? newestConversation(this.cwd)
    if (previous) {
      this.sessionId ??= previous.sessionId
      rememberSession(this.cwd, previous.sessionId)
    }
    // Sent even when there is nothing: arriving somewhere new must clear what
    // was on screen, not leave the last folder's conversation standing.
    this.emit({
      kind: 'backlog',
      sessionId: previous?.sessionId ?? null,
      lines: previous?.backlog ?? [],
    })
    if (!this.stream) this.open()
    void this.reportStatus()
    this.emit({ kind: 'settings', settings: this.settings, models: this.models })
    this.emit({ kind: 'commands', commands: this.commands })
    void this.tellLines()
    this.emit({ kind: 'speech', language: replyLanguage(), chosen: chosenSpeech() })
  }

  /** Another language for her. The session carries it in its environment, so it
   * is reopened on the same conversation, and the window's own lines are asked
   * for again in the new one. */
  speakIn() {
    this.lines = null
    this.reopen()
    void this.tellLines()
    this.emit({ kind: 'speech', language: replyLanguage(), chosen: chosenSpeech() })
  }

  /**
   * What the window says as her, in the language the café is set to. English is
   * the app's own copy and needs no asking; anything else she writes once and
   * the window keeps it, so this is a file read on every start but a session
   * only on the first one — or on the first one after the master signs in.
   */
  private async tellLines() {
    if (this.writingLines) return
    const language = replyLanguage()
    const kept = knownLines(language)
    if (kept) {
      this.lines = kept
      this.emit({ kind: 'lines', lines: kept })
      return
    }
    this.writingLines = true
    let written: Lines | null
    try {
      written = await askForLines(language, personaOf(CAFE_PLUGIN))
    } finally {
      this.writingLines = false
    }
    if (replyLanguage() !== language) {
      // Told to speak something else again before this trip came back — what
      // it wrote is for a language nobody asked for any more.
      void this.tellLines()
      return
    }
    if (!written) return // nobody to ask yet: English stands, and it asks again later
    this.lines = written
    this.emit({ kind: 'lines', lines: written })
  }

  /** Model and mode can be turned while she is standing there; effort is fixed
   * when the session opens, so it is picked up the next time one does. */
  configure(patch: Partial<SessionSettings>) {
    this.settings = { ...this.settings, ...patch }
    if (patch.model !== undefined) void this.stream?.setModel(patch.model ?? undefined).catch(() => {})
    if (patch.mode !== undefined) void this.stream?.setPermissionMode(patch.mode).catch(() => {})
    if (patch.effort !== undefined) this.reopen()
    this.emit({ kind: 'settings', settings: this.settings, models: this.models })
  }

  /** Drop the connection but keep the conversation: the next prompt reopens it
   * on the same session id, with whatever the settings now say. Whatever was
   * running or queued on the connection going away cannot finish on it — the
   * same closing-out `close()` does for a run, minus the parts of `close()`
   * that end the conversation itself. */
  private reopen() {
    const stream = this.stream
    this.stream = null
    this.closeRuns()
    // The reader on the connection going away must not end up catching a
    // line typed for the one about to replace it — so it gets a queue of its
    // own, not the one `closeRuns()` merely emptied.
    this.prompts = new PromptQueue()
    void stream?.return(undefined).catch(() => {})
  }

  /** Nothing still open here is going to answer for itself, so this says so
   * on its behalf: every run told done, whatever was still waiting behind
   * them in `backlog` dropped before it was ever sent to the CLI, and
   * anything parked on an answer — hers or the master's — resolved with
   * nothing rather than left hanging. `error` rides along on every `done` so
   * a run that stopped because the connection itself died can say so.
   *
   * The prompt queue is only emptied of what has not been read yet here, not
   * replaced — the reader on the far end of it may still be the live
   * connection's own, and a line typed right after this must still reach it.
   * `reopen()` and `close()`, which are abandoning that reader along with the
   * connection itself, swap in a fresh queue of their own once this returns. */
  private closeRuns(error?: string) {
    for (const run of this.runs) this.emit({ kind: 'done', runId: run.runId, error })
    this.runs = []
    this.backlog = []
    this.prompts.clear()
    for (const resolve of this.waiting.values()) resolve([])
    this.waiting.clear()
  }

  /** A prompt asked for while nothing is running reaches the CLI at once —
   * the SDK drains `prompts` the instant anything lands in it, which is
   * exactly what makes `interrupt()` able to catch a queued one at all: it
   * only has to discard what is still sitting here in `backlog`, never
   * having been sent, rather than chase something already on its way to
   * stdin. */
  ask(runId: string, prompt: string, images: Attachment[] = []) {
    if (!this.stream) this.open()
    const inFlight = this.runs.length > 0
    this.runs.push({ runId, turn: new Turn(prompt) })
    if (inFlight) this.backlog.push({ runId, prompt, images })
    else this.prompts.push(prompt, images)
  }

  answer(askId: string, value: unknown) {
    const resolve = this.waiting.get(askId)
    if (!resolve) return
    this.waiting.delete(askId)
    resolve(value)
  }

  /** Stop what she is doing — all of it. Every run is closed out here and
   * now, the one running included: an interrupt that lands mid-tool may never
   * be answered with a result, and a run left open waiting for one would sit
   * at the head of the queue jamming every turn after it. Only that one was
   * ever actually handed to the CLI — everything queued behind it was still
   * sitting in `backlog`, never sent, so `closeRuns()` dropping it is enough
   * to keep it from running to completion with nobody watching. The turn
   * that was running keeps going on the CLI's side until its own abort
   * catches up, though, and whatever it still says belongs to a turn nothing
   * here remembers any more — `deadRuns` is what stops `pump()` mistaking
   * that drift-back for an answer to whatever is asked next. */
  interrupt() {
    void this.stream?.interrupt().catch(() => {})
    if (this.runs.length) this.deadRuns++
    this.closeRuns()
  }

  /** The conversations held in this folder, for the master to pick from. */
  conversations() {
    return listConversations(this.cwd)
  }

  /**
   * Go back to a conversation this folder has had. The connection is dropped
   * rather than told — the SDK resumes a session when it opens, so the next
   * prompt is what picks it up, with everything that was said already on screen.
   */
  resume(sessionId: string) {
    if (sessionId === this.sessionId) return
    this.close()
    this.sessionId = sessionId
    rememberSession(this.cwd, sessionId)
    this.emit({ kind: 'backlog', sessionId, lines: conversationBacklog(this.cwd, sessionId) ?? [] })
    void this.reportStatus(null)
  }

  /** Throw the conversation away — the next prompt starts a blank one. */
  reset() {
    this.close()
    this.sessionId = null
    forgetSession(this.cwd)
    this.emit({ kind: 'backlog', sessionId: null, lines: [] })
    void this.reportStatus(null)
  }

  /** The window went away. Everything in flight stops, but the conversation is
   * remembered — closing a window is not the same as ending a conversation. */
  close() {
    const stream = this.stream
    this.stream = null
    this.closeRuns()
    // Same reasoning as `reopen()`: the reader on this connection is being
    // abandoned along with it, so the next one gets a queue nobody else is
    // still listening to.
    this.prompts = new PromptQueue()
    this.stopWatchingLook?.()
    this.stopWatchingLook = null
    this.lookSessionId = null
    void stream?.return(undefined).catch(() => {})
  }

  /** The status line only ever shows measured things, so it is refreshed from
   * the folder and the turn that just ended. */
  async reportStatus(contextTokens: number | null = this.lastContext) {
    this.lastContext = contextTokens
    const git = await readGit(this.cwd)
    this.emit({
      kind: 'status',
      status: { branch: null, added: 0, removed: 0, ...git, contextTokens },
    })
  }

  private open() {
    const options: Options = {
      cwd: this.cwd,
      canUseTool: (toolName, input) => this.decide(toolName, input),
      // A client working on a real project should honour that project's own
      // settings, memory and plugins — the same files Claude Code reads.
      settingSources: ['user', 'project', 'local'],
      plugins: [{ type: 'local', path: CAFE_PLUGIN }],
      // Who the café's remaining hooks think is on shift — the mirror and the
      // diary ask, and the sprite is ことね, so it can't be the random draw a
      // terminal session gets. What she speaks is not pinned: that is the
      // café's own setting until ⌘K says otherwise, so an untouched window
      // answers in the same language his terminal does. `env` replaces the
      // subprocess environment outright, hence the spread.
      env: { ...process.env, CLAUDE_MAID: 'kotone', ...(chosenSpeech() ? { CLAUDE_MAID_LANG: chosenSpeech() } : {}) },
      // The window is a scene, not a transcript: one spoken line at a time, a
      // face over the name plate, a panel for anything long. She needs to know
      // that, on top of everything Claude Code normally tells her.
      systemPrompt: { type: 'preset', preset: 'claude_code', append: shiftBrief() },
      mcpServers: { cafe: cafeTools },
      resume: this.sessionId ?? undefined,
      permissionMode: this.settings.mode,
      effort: this.settings.effort,
      ...(this.settings.model ? { model: this.settings.model } : {}),
    }
    this.stream = query({ prompt: this.prompts, options })
    // The session answers these as soon as it is connected; waiting for the init
    // message would mean waiting for the master to say something first.
    void this.checkWayIn(this.stream)
    void this.readModels(this.stream)
    void this.readCommands(this.stream)
    void this.pump(this.stream)
  }

  /**
   * Whether the session got in at all, asked before the master says anything.
   *
   * The window borrows Claude Code's login, and a Mac that has never signed in
   * does not fail — it waits, on a question nobody in this window can see. So
   * the wait itself is the answer: a session that has not reported in by now is
   * one nobody is going to answer, and the panel says so while he can still do
   * something about it, rather than after a turn that never came back.
   */
  private async checkWayIn(stream: Query) {
    const late = Symbol('late')
    let timer!: ReturnType<typeof setTimeout>
    const answered = await Promise.race([
      stream.initializationResult().catch((error) => error as Error),
      new Promise<symbol>((resolve) => {
        timer = setTimeout(() => resolve(late), WAY_IN_TIMEOUT)
      }),
    ])
    clearTimeout(timer) // answered one way or another — the door does not need watching any more
    if (this.stream !== stream) return // reopened meanwhile; that one asks for itself
    if (answered === late) {
      this.emit({
        kind: 'trouble',
        trouble: { reason: 'sign-in', detail: `The session did not report in within ${WAY_IN_TIMEOUT / 1000}s.` },
      })
    } else if (answered instanceof Error) {
      const reason = whyStopped(answered.message) ?? 'sign-in'
      this.emit({ kind: 'trouble', trouble: { reason, detail: answered.message } })
    } else {
      this.emit({ kind: 'trouble', trouble: null }) // in: whatever was on screen is over
    }
  }

  /** Try the way in again — he has just gone and signed in somewhere else. The
   * conversation is kept; only the connection is thrown away and made afresh. */
  reconnect() {
    this.reopen()
    this.open()
  }

  private async pump(stream: Query) {
    try {
      for await (const sdk of stream) {
        // `reopen()`/`close()` tell the old connection to end with
        // `stream.return()`, but a `next()` already in flight when that
        // happens still resolves once more — with a message from a
        // connection that, as far as this session is concerned, is already
        // gone. Acting on it here could close out a run belonging to the
        // one that replaced it, or (system/init) misremember whose session
        // this is. The captured `stream` local is what makes the check mean
        // anything — `this.stream` may already be pointed elsewhere.
        if (this.stream !== stream) return
        // A skill discovered while she works changes what `/` offers; the
        // session pushes the whole list again rather than a delta.
        if (sdk.type === 'system' && sdk.subtype === 'commands_changed') {
          this.tellCommands(sdk.commands)
        }
        if (sdk.type === 'system' && sdk.subtype === 'init') {
          this.sessionId = sdk.session_id
          rememberSession(this.cwd, sdk.session_id)
          this.followLook(sdk.session_id)
        }
        // Every reply of hers was answered with the whole conversation in front
        // of it, so the newest one measures what the conversation now costs to
        // ask anything at all. A subagent's replies are its own context, not
        // this one's, and are left out of it.
        if (sdk.type === 'assistant' && !sdk.parent_tool_use_id && sdk.message?.usage) {
          this.lastContext = contextTokens(sdk.message.usage)
        }
        if (this.deadRuns > 0) {
          // Still owed a result for a turn `interrupt()` already closed out
          // on this end — everything about it, chunks included, belongs to
          // nobody now, so it is dropped rather than attributed to whatever
          // is running next.
          if (sdk.type === 'result') this.deadRuns--
          continue
        }
        const run = this.runs[0]
        if (!run) continue
        for (const message of run.turn.read(sdk)) {
          this.emit({ kind: 'message', runId: run.runId, message })
        }
        if (sdk.type === 'result') {
          // A turn that came back is proof there is someone to ask, which is
          // what writing her lines needs and what a signed-out window lacked.
          if (!this.lines) void this.tellLines()
          this.emit({ kind: 'done', runId: run.runId })
          this.runs.shift()
          void this.reportStatus()
          // Nothing was in flight the instant this run's turn was pushed, so
          // whatever was asked for behind it — held in `backlog` rather than
          // handed to the CLI — can go now.
          const next = this.backlog.shift()
          if (next) this.prompts.push(next.prompt, next.images)
        }
      }
    } catch (error) {
      if (this.stream !== stream) return // already replaced by reset()
      this.stream = null
      const message = error instanceof Error ? error.message : String(error)
      // Something the master has to go and fix is explained in a panel; the run
      // then ends quietly, because a toast saying the same thing twice is noise.
      const reason = whyStopped(message)
      if (reason) this.emit({ kind: 'trouble', trouble: { reason, detail: message } })
      this.closeRuns(reason ? undefined : message)
      // Same reasoning as `reopen()`/`close()`: this connection is dead, so
      // the next one gets a queue nobody else is still listening to.
      this.prompts = new PromptQueue()
    }
  }

  /** Which models the account can actually pick, and what effort each takes —
   * only the open session can say. */
  private async readModels(stream: Query) {
    const models = await stream.supportedModels().catch(() => [])
    this.models = models.map((model) => ({
      value: model.value,
      label: nameOf(model, models),
      efforts: model.supportedEffortLevels ?? [],
    }))
    this.emit({ kind: 'settings', settings: this.settings, models: this.models })
  }

  /**
   * The numbers behind /usage, straight from the session — the same ones the
   * terminal's panel draws its bars from. The command's own printout is a
   * flattened summary of this, so the window reads the source instead.
   */
  async usage(): Promise<UsageReport | null> {
    if (!this.stream) this.open()
    const report = await this.stream
      ?.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET()
      .catch(() => null)
    return report ? readUsage(report) : null
  }

  /** Where this conversation's context has gone — the same accounting the
   * /context command prints, before it is flattened into tables. */
  async context(): Promise<ContextReport | null> {
    if (!this.stream) this.open()
    const report = await this.stream?.getContextUsage().catch(() => null)
    if (!report) return null
    return {
      model: report.model,
      totalTokens: report.totalTokens,
      maxTokens: report.maxTokens,
      percentage: report.percentage,
      categories: report.categories.map(({ name, tokens, isDeferred }) => ({
        name,
        tokens,
        deferred: isDeferred ?? false,
      })),
      memoryFiles: report.memoryFiles.map(({ path: file, tokens }) => ({ path: file, tokens })),
      mcpTools: report.mcpTools.map(({ name, serverName, tokens }) => ({
        name,
        server: serverName,
        tokens,
      })),
    }
  }

  /** The subagents this folder can call on, as the session resolved them. */
  async agents(): Promise<Subagent[]> {
    if (!this.stream) this.open()
    const agents = (await this.stream?.supportedAgents().catch(() => [])) ?? []
    return agents.map(({ name, description, model }) => ({
      name,
      description,
      model: model ?? null,
    }))
  }

  /** Every configured MCP server and whether it answered — the connection is
   * the session's, so only the session can say. */
  async mcpServers(): Promise<McpServer[]> {
    if (!this.stream) this.open()
    const servers = (await this.stream?.mcpServerStatus().catch(() => [])) ?? []
    return servers.map((server) => ({
      name: server.name,
      status: server.status,
      scope: server.scope ?? null,
      tools: server.tools?.length ?? 0,
      error: server.error ?? null,
    }))
  }

  /** Who the session is signed in as and what it was given to work with. */
  async status(): Promise<StatusReport | null> {
    if (!this.stream) this.open()
    const init = await this.stream?.initializationResult().catch(() => null)
    if (!init) return null
    const servers = await this.mcpServers()
    return {
      cwd: this.cwd,
      account: {
        email: init.account.email ?? null,
        organization: init.account.organization ?? null,
        plan: init.account.subscriptionType ?? null,
        provider: init.account.apiProvider ?? null,
      },
      outputStyle: init.output_style,
      commands: init.commands.length,
      agents: init.agents.length,
      mcpServers: servers.filter((server) => server.status === 'connected').length,
    }
  }

  /** What `/` offers in this folder: the built-ins, plus whatever its settings,
   * skills and plugins add — the same list the terminal would show. */
  private async readCommands(stream: Query) {
    this.tellCommands(await stream.supportedCommands().catch(() => []))
  }

  private tellCommands(commands: SlashCommand[]) {
    this.commands = commands.map(({ name, description, argumentHint }) => ({
      name,
      description,
      argumentHint,
    }))
    this.emit({ kind: 'commands', commands: this.commands })
  }

  /** The plugin files its looks under the session id, so the window can only
   * start watching once the SDK has told it which session this is. */
  private followLook(sessionId: string) {
    if (sessionId === this.lookSessionId) return
    this.stopWatchingLook?.()
    this.lookSessionId = sessionId
    this.stopWatchingLook = watchLook(sessionId, (look) => this.emit({ kind: 'look', look }))
  }

  private async decide(toolName: string, input: Record<string, unknown>): Promise<PermissionResult> {
    const run = this.runs[0]
    if (!run) return { behavior: 'deny', message: 'No conversation is running.' }

    // Her own two tools only move the scene around — nothing to ask about.
    if (toolName === EXPRESSION_TOOL || toolName === REPORT_TOOL) return { behavior: 'allow' }

    if (toolName === 'AskUserQuestion') {
      return { behavior: 'allow', updatedInput: await this.collectAnswers(run.runId, input) }
    }

    const askId = randomUUID()
    const reply = this.park<{ behavior: 'allow' | 'deny' }>(askId)
    this.emit({ kind: 'ask-permission', runId: run.runId, askId, toolName, input })
    const decision = await reply
    if (decision.behavior === 'allow') return { behavior: 'allow' }
    return { behavior: 'deny', message: 'The master said no.' }
  }

  /**
   * AskUserQuestion is answered by handing the tool its own input back with an
   * `answers` map filled in — question text to the picked labels.
   */
  private async collectAnswers(runId: string, input: Record<string, unknown>) {
    const questions = (input.questions ?? []) as Question[]
    const answers: Record<string, string> = {}

    for (const question of questions) {
      const askId = randomUUID()
      const reply = this.park<string[]>(askId)
      this.emit({ kind: 'ask-question', runId, askId, question })
      answers[question.question] = (await reply).join(', ')
    }
    return { ...input, answers }
  }

  private park<T>(askId: string) {
    return new Promise<T>((resolve) => this.waiting.set(askId, resolve as (value: unknown) => void))
  }
}

/** 'Default (recommended)' says which row to pick, not who answers. The row it
 * resolves to carries the actual name, so the default borrows it — 'Opus 4.5
 * (default)' on the plaque instead of a label about labels. */
export function nameOf(model: ModelInfo, all: ModelInfo[]) {
  if (model.value !== 'default' || !model.resolvedModel) return model.displayName
  const resolved = all.find(
    (other) => other.value !== 'default' && (other.resolvedModel ?? other.value) === model.resolvedModel,
  )
  return resolved ? `${resolved.displayName} (default)` : model.displayName
}

/** The prompt side of streaming input: an iterable the SDK can sit and wait on. */
export class PromptQueue implements AsyncIterable<SDKUserMessage> {
  private queued: { text: string; images: Attachment[] }[] = []
  private wake: (() => void) | null = null

  push(text: string, images: Attachment[] = []) {
    this.queued.push({ text, images })
    this.wake?.()
    this.wake = null
  }

  /** Drop everything not yet handed to the reader. The SDK's own interrupt
   * only stops the turn already running; whatever is still sitting in this
   * queue behind it is stopped here instead, before it is ever read. */
  clear() {
    this.queued = []
  }

  async *[Symbol.asyncIterator]() {
    for (;;) {
      const said = this.queued.shift()
      if (said === undefined) {
        await new Promise<void>((resolve) => (this.wake = resolve))
        continue
      }
      // A prompt with something to look at is a list of blocks — the pictures
      // first, so what he says about them is read after they are seen.
      const content = said.images.length
        ? [
            ...said.images.map((image) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: image.mediaType as 'image/png', data: image.data },
            })),
            { type: 'text' as const, text: said.text },
          ]
        : said.text
      yield {
        type: 'user' as const,
        message: { role: 'user' as const, content },
        parent_tool_use_id: null,
      }
    }
  }
}

/**
 * What the session died of, as far as the master is concerned. The SDK hands
 * back whatever the CLI printed, and the three named here are all things he has
 * to go and fix somewhere else — no amount of asking her again will help.
 */
export function whyStopped(message: string): Trouble['reason'] | null {
  const said = message.toLowerCase()
  if (/login|log in|not authenticated|unauthori[sz]ed|invalid api key|oauth|credentials/.test(said)) return 'sign-in'
  if (/usage limit|rate limit|quota|credit balance|too low/.test(said)) return 'limit'
  if (/enotfound|econnrefused|etimedout|network|offline|fetch failed|getaddrinfo/.test(said)) return 'offline'
  // Everything else keeps its own words: the run reports it, with a retry.
  return null
}
