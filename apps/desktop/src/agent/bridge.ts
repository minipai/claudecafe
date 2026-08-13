import type { AgentMessage, Look, Question } from './types'

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
  | { kind: 'message'; runId: string; message: AgentMessage }
  | { kind: 'ask-permission'; runId: string; askId: string; toolName: string; input: Record<string, unknown> }
  | { kind: 'ask-question'; runId: string; askId: string; question: Question }
  | { kind: 'done'; runId: string; error?: string }

export type CafeBridge = {
  /** The folder this window was opened on. One window, one project. */
  cwd: string
  start(runId: string, prompt: string): void
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
  listen(onEvent: (event: BridgeEvent) => void): () => void
}

declare global {
  interface Window {
    cafe?: CafeBridge
  }
}
