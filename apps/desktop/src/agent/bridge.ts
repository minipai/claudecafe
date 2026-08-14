import type { AgentMessage, Attachment, Look, Question } from './types'

/**
 * The wire between the window and the Electron main process, where the real
 * Agent SDK lives. Everything crossing it is plain JSON — the callbacks the
 * SDK wants (`canUseTool`, the AskUserQuestion answer) become an ask/answer
 * pair keyed by `askId`.
 */
/** What the status line is allowed to say — every field is measured, and a
 * field that cannot be measured is null rather than filled in. */
export type SessionStatus = {
  branch: string | null
  added: number
  removed: number
  /** Tokens of context the last turn carried. */
  contextTokens: number | null
}

/** What the session runs as. Every value is one the SDK actually takes. */
export type SessionSettings = {
  /** null = whatever the CLI is configured to use. */
  model: string | null
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  /** The CLI's permission modes, minus bypass — this window asks for itself. */
  mode: 'default' | 'auto' | 'acceptEdits' | 'plan'
}

/** One model the account can actually pick, as the SDK reports it. */
export type ModelChoice = { value: string; label: string; efforts: SessionSettings['effort'][] }

/** One slash command this folder answers to — the CLI's own list, so it covers
 * built-ins, the project's commands, its skills and its plugins alike. */
export type CafeCommand = { name: string; description: string; argumentHint: string }

/** One rate-limit window as the plan reports it — the bars the terminal's
 * /usage panel draws, with nothing added that was not measured. */
export type UsageWindow = { label: string; percent: number | null; resetsAt: string | null }

/** What /usage is really made of, taken from the session rather than from the
 * text the command prints. */
export type UsageReport = {
  /** This session: what it cost and what it changed. */
  cost: number
  linesAdded: number
  linesRemoved: number
  windows: UsageWindow[]
  /** The last 7 days on this machine, as the CLI scans them — approximate by
   * its own admission, and absent for accounts with no plan limits. */
  week: {
    requests: number
    sessions: number
    behaviours: { label: string; pct: number }[]
    skills: { name: string; pct: number }[]
    agents: { name: string; pct: number }[]
  } | null
}

/** Where the context window has gone, as the session accounts for it. */
export type ContextReport = {
  model: string
  totalTokens: number
  maxTokens: number
  percentage: number
  /** Deferred means loaded on demand — it is counted, but only some of it is
   * ever in the prompt at once. */
  categories: { name: string; tokens: number; deferred: boolean }[]
  memoryFiles: { path: string; tokens: number }[]
  mcpTools: { name: string; server: string; tokens: number }[]
}

/** One subagent this folder can call on. */
export type Subagent = { name: string; description: string; model: string | null }

/** One MCP server, as the session finds it. */
export type McpServer = {
  name: string
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'
  /** Where it was configured — project, user, local. */
  scope: string | null
  tools: number
  error: string | null
}

/** Who she is signed in as and what this window runs on. */
export type StatusReport = {
  cwd: string
  account: {
    email: string | null
    organization: string | null
    plan: string | null
    /** Which backend the session authenticates against. */
    provider: string | null
  }
  outputStyle: string
  /** What the session has to work with, counted rather than listed. */
  commands: number
  agents: number
  mcpServers: number
}

/** One conversation this folder has had, as the transcripts remember it. */
export type Conversation = { sessionId: string; opening: string; at: number }

/** A line from the conversation this window reopened on. */
export type BacklogLine = { role: 'user' | 'assistant' | 'event'; content: string; at: number }

/**
 * Why she cannot work, when the reason is not hers to fix. The window borrows
 * Claude Code's own login and network, so the master has to be told which of
 * those is in the way — an unread error string in a dialogue box is not telling.
 */
export type Trouble = {
  reason: 'sign-in' | 'limit' | 'offline'
  /** What actually came back, kept for the master who wants to see it. */
  detail: string
}

/**
 * The few things the window says as her, when no model is writing. English is
 * built in; anything else she writes once and the window keeps. Nothing here
 * takes an argument — what she is asking about is already on screen beside her.
 */
export type Lines = {
  greeting: string
  interrupted: string
  commandAsk: string
  editAsk: string
  planAsk: string
  errorTitle: string
}

export type BridgeEvent =
  | { kind: 'status'; status: SessionStatus }
  /** The session could not run at all — signed out, out of allowance, offline. */
  | { kind: 'trouble'; trouble: Trouble }
  /** Her own wording for what the window says as her, once it is written. */
  | { kind: 'lines'; lines: Lines }
  /** What she is speaking, and what the window was told to make her speak —
   * empty when that is left to the café's own setting. */
  | { kind: 'speech'; language: string; chosen: string }
  /** The interface's language changed — the code to draw it in, and what was
   * picked (which may be `system`). */
  | { kind: 'locale'; locale: string; choice: string }
  /** A fresh look from the café plugin — shot in the background, so it lands
   * whenever it lands rather than inside a run. */
  | { kind: 'look'; look: Look }
  /** The conversation as the transcript has it — sent on refresh, which is how
   * the backlog survives a reload. */
  | { kind: 'backlog'; sessionId: string | null; lines: BacklogLine[] }
  | { kind: 'settings'; settings: SessionSettings; models: ModelChoice[] }
  /** The folder she is on now — it changes under the window when she is sent
   * somewhere else, so nothing may read it once and keep it. */
  | { kind: 'folder'; cwd: string }
  /** What `/` offers. Sent when the session says so — a skill picked up while
   * she works changes the list mid-conversation. */
  | { kind: 'commands'; commands: CafeCommand[] }
  | { kind: 'message'; runId: string; message: AgentMessage }
  | { kind: 'ask-permission'; runId: string; askId: string; toolName: string; input: Record<string, unknown> }
  | { kind: 'ask-question'; runId: string; askId: string; question: Question }
  | { kind: 'done'; runId: string; error?: string }

export type CafeBridge = {
  /** The folder this window was opened on. One window, one project. */
  cwd: string
  /** The language code the interface is drawn in — `en-AU`, `zh-TW`. Resolved:
   * following the system is already worked out by the time it gets here. */
  locale: string
  /** What was picked, which may be `system`. */
  localeChoice: string
  /** Draw the interface in another language, and keep that choice. */
  setLocale(choice: string): void
  /** Have her reply in this — free text, empty to follow the café's setting. */
  setSpeech(language: string): void
  start(runId: string, prompt: string, images: Attachment[]): void
  answer(askId: string, value: unknown): void
  interrupt(runId: string): void
  /** Drop the conversation and start a fresh one on the next prompt. */
  newSession(): void
  /** Open the session and report what is in it — status, backlog, settings.
   * The window asks once it is listening. */
  refresh(): void
  /** Change what the session runs as. Model and mode take effect at once; a new
   * effort is picked up on the next turn. */
  configure(patch: Partial<SessionSettings>): void
  /** What the plan and this session have been spent on. Null when the session
   * cannot say — an API key has no plan windows to report. */
  usage(): Promise<UsageReport | null>
  /** What is filling the context window right now. */
  context(): Promise<ContextReport | null>
  /** The subagents this folder can call on. */
  agents(): Promise<Subagent[]>
  /** Every configured MCP server and whether it answered. */
  mcpServers(): Promise<McpServer[]>
  /** Who she is signed in as, and what this window is working on. */
  status(): Promise<StatusReport | null>
  /** The conversations held in this folder, newest first. */
  conversations(): Promise<Conversation[]>
  /** The folders she has been opened on, most recent first. */
  folders(): Promise<string[]>
  /** Send her to another folder — this window, a fresh conversation there. */
  switchFolder(cwd: string): void
  /** Go back to one of them; the backlog comes back with it. */
  resume(sessionId: string): void
  /** Ask for a folder that is not in the list, and go there. */
  openFolder(): Promise<string | null>
  /** Say something where the master is, when he is not watching the window.
   * `waiting` means she has stopped and needs an answer. */
  notify(body: string, waiting: boolean): void
  /** Hand the pointer to whatever is behind the window, or take it back. The
   * window is transparent, so its empty half should not catch clicks. */
  clickThrough(through: boolean): void
  /** Where a dropped file lives, which only the main world can say. */
  pathFor(file: File): string
  /** Picking her up moves the window; letting go puts it down. */
  startDrag(): void
  endDrag(): void
  listen(onEvent: (event: BridgeEvent) => void): () => void
}

declare global {
  interface Window {
    cafe?: CafeBridge
  }
}
