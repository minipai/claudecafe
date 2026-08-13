import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { query, type Options, type PermissionResult, type Query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { Turn } from './translate'
import { cafeTools, EXPRESSION_TOOL, REPORT_TOOL } from './tools'
import { watchLook } from './look'
import { forgetSession, lastConversation, rememberSession } from './history'
import { readGit } from './status'
import type { BridgeEvent, ModelChoice, SessionSettings } from '../src/agent/bridge'
import type { Question } from '../src/agent/types'

/** How much context the turn carried: everything the model was handed as prompt. */
function contextTokens(usage: { input_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) {
  return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0)
}

type Emit = (event: BridgeEvent) => void

/** The café plugin staged next to the bundled main process at build time. It is
 * loaded by name, so a copy installed from the marketplace steps aside for it
 * rather than greeting the master twice. */
const CAFE_PLUGIN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cafe-plugin')

const SCENE_BRIEF = `You are being watched through a window, not a terminal — the master sees you standing there, one spoken line at a time.

- Speak in short replies — a few sentences, the way someone standing there would. A paragraph or two is still fine to say out loud.
- Only what is genuinely too long to say belongs in the ${REPORT_TOOL} tool: an investigation, a walkthrough, a comparison, anything with headings or code blocks. It puts the body behind a link the master opens when he wants it, and she only says the one line you give it. Never paste something that long into your reply instead.
- Call ${EXPRESSION_TOOL} when your mood changes, so your face keeps up with the work.`

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
  private waiting = new Map<string, (value: unknown) => void>()
  private lastContext: number | null = null
  private lookSessionId: string | null = null
  private stopWatchingLook: (() => void) | null = null
  /** The conversation this window is on — the previous one until the SDK says
   * otherwise, so a reload picks up where the master left off. */
  private sessionId: string | null = null
  private settings: SessionSettings = { model: null, effort: 'high', mode: 'default' }
  private models: ModelChoice[] = []

  constructor(private cwd: string, private emit: Emit) {}

  /** The window is listening: open the session and tell it everything that is
   * already true — the folder's state, what was said last time, what it runs as. */
  refresh() {
    // The window asking is a window with nothing in it — a reload, a hot reload,
    // a second window on the same folder. What was said lives in the transcript,
    // so it is sent every time, not only the first time the session is learned.
    const previous = lastConversation(this.cwd)
    if (previous) {
      this.sessionId ??= previous.sessionId
      this.emit({ kind: 'backlog', lines: previous.backlog })
    }
    if (!this.stream) this.open()
    void this.reportStatus()
    this.emit({ kind: 'settings', settings: this.settings, models: this.models })
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
   * on the same session id, with whatever the settings now say. */
  private reopen() {
    const stream = this.stream
    this.stream = null
    void stream?.return(undefined).catch(() => {})
  }

  ask(runId: string, prompt: string) {
    if (!this.stream) this.open()
    this.runs.push({ runId, turn: new Turn() })
    this.prompts.push(prompt)
  }

  answer(askId: string, value: unknown) {
    const resolve = this.waiting.get(askId)
    if (!resolve) return
    this.waiting.delete(askId)
    resolve(value)
  }

  interrupt() {
    void this.stream?.interrupt().catch(() => {})
  }

  /** Throw the conversation away — the next prompt starts a blank one. */
  reset() {
    this.close()
    this.sessionId = null
    forgetSession(this.cwd)
    this.emit({ kind: 'backlog', lines: [] })
    void this.reportStatus(null)
  }

  /** The window went away. Everything in flight stops, but the conversation is
   * remembered — closing a window is not the same as ending a conversation. */
  close() {
    const stream = this.stream
    this.stream = null
    for (const run of this.runs) this.emit({ kind: 'done', runId: run.runId })
    this.runs = []
    this.prompts = new PromptQueue()
    this.waiting.clear()
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
      // The sprite and the name plate are ことね, so the shift can't be drawn at
      // random the way a terminal session does — CLAUDE_MAID pins her. `env`
      // replaces the subprocess environment outright, hence the spread.
      env: { ...process.env, CLAUDE_MAID: 'kotone' },
      // The window is a scene, not a transcript: one spoken line at a time, a
      // face over the name plate, a panel for anything long. She needs to know
      // that, on top of everything Claude Code normally tells her.
      systemPrompt: { type: 'preset', preset: 'claude_code', append: SCENE_BRIEF },
      mcpServers: { cafe: cafeTools },
      resume: this.sessionId ?? undefined,
      permissionMode: this.settings.mode,
      effort: this.settings.effort,
      ...(this.settings.model ? { model: this.settings.model } : {}),
    }
    this.stream = query({ prompt: this.prompts, options })
    // The session answers this as soon as it is connected; waiting for the init
    // message would mean waiting for the master to say something first.
    void this.readModels(this.stream)
    void this.pump(this.stream)
  }

  private async pump(stream: Query) {
    try {
      for await (const sdk of stream) {
        if (sdk.type === 'system' && sdk.subtype === 'init') {
          this.sessionId = sdk.session_id
          rememberSession(this.cwd, sdk.session_id)
          this.followLook(sdk.session_id)
        }
        const run = this.runs[0]
        if (!run) continue
        for (const message of run.turn.read(sdk)) {
          this.emit({ kind: 'message', runId: run.runId, message })
        }
        if (sdk.type === 'result') {
          this.emit({ kind: 'done', runId: run.runId })
          this.runs.shift()
          void this.reportStatus(contextTokens(sdk.usage))
        }
      }
    } catch (error) {
      if (this.stream !== stream) return // already replaced by reset()
      this.stream = null
      const message = error instanceof Error ? error.message : String(error)
      for (const run of this.runs) this.emit({ kind: 'done', runId: run.runId, error: message })
      this.runs = []
    }
  }

  /** Which models the account can actually pick, and what effort each takes —
   * only the open session can say. */
  private async readModels(stream: Query) {
    const models = await stream.supportedModels().catch(() => [])
    this.models = models.map((model) => ({
      value: model.value,
      label: model.displayName,
      efforts: model.supportedEffortLevels ?? [],
    }))
    this.emit({ kind: 'settings', settings: this.settings, models: this.models })
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

/** The prompt side of streaming input: an iterable the SDK can sit and wait on. */
class PromptQueue implements AsyncIterable<SDKUserMessage> {
  private queued: string[] = []
  private wake: (() => void) | null = null

  push(text: string) {
    this.queued.push(text)
    this.wake?.()
    this.wake = null
  }

  async *[Symbol.asyncIterator]() {
    for (;;) {
      const text = this.queued.shift()
      if (text === undefined) {
        await new Promise<void>((resolve) => (this.wake = resolve))
        continue
      }
      yield {
        type: 'user' as const,
        message: { role: 'user' as const, content: text },
        parent_tool_use_id: null,
      }
    }
  }
}
