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

/** A line from the conversation this window reopened on. */
export type BacklogLine = { role: 'user' | 'assistant' | 'event'; content: string; at: number }

export type BridgeEvent =
  | { kind: 'status'; status: SessionStatus }
  /** A fresh look from the café plugin — shot in the background, so it lands
   * whenever it lands rather than inside a run. */
  | { kind: 'look'; look: Look }
  /** The conversation as the transcript has it — sent on refresh, which is how
   * the backlog survives a reload. */
  | { kind: 'backlog'; lines: BacklogLine[] }
  | { kind: 'settings'; settings: SessionSettings; models: ModelChoice[] }
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
