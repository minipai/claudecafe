import type { Expression } from './expressions'
/** Shapes inspired by @anthropic-ai/claude-agent-sdk, simplified for the mock. */

/** How the answer reaches the master: said plainly, said with shape (lists,
 * code, emphasis — laid out in the box), or handed over as writing. */
export type Tier = 'light' | 'medium' | 'heavy'

/** One row of the model's own task list. The real SDK streams this as per-item
 * TaskCreate/TaskUpdate calls (TodoWrite before v2.1.142); the adapter accumulates
 * them into the whole list the UI renders. */
export type Todo = { content: string; status: 'pending' | 'in_progress' | 'completed' }

/** A "look snapshot" — mirrors the cafe plugin's look.txt: a model-generated
 * third-person scene + one line of dialogue, regenerated when a piece of work
 * finishes. Stays on screen until the next one replaces it. */
export type Look = { scene: string; dialogue: string }

/** Writing she hands over instead of saying out loud: the markdown body, plus
 * the words she puts on the link that opens it. */
export type Report = { label: string; body: string }

export type AgentMessage =
  | { type: 'system'; subtype: 'init' | 'compact_boundary' } // compact_boundary fires after the history is summarised
  // label = 地の文 narration line; silent = already has its own place on screen
  | { type: 'tool_use'; name: string; label: string; input?: Record<string, unknown>; silent?: boolean }
  // expression = the face she signed this line with; it goes on when the line does
  | { type: 'text_delta'; text: string; expression?: Expression }
  | { type: 'look'; look: Look }
  | { type: 'thinking'; text: string } // a line of the model's own reasoning
  | { type: 'todos'; todos: Todo[] } // the model's task list, replaced wholesale on every write
  // mood = the 【…】 marker she signed with, for the log
  // said = the line is already on screen; the result is only the record of it
  | { type: 'result'; tier: Tier; line: string; report?: Report; mood?: string; said?: boolean; expression?: Expression }

export type PermissionResult = { behavior: 'allow' } | { behavior: 'deny' }

/** A question the model asks the player — the SDK's AskUserQuestion tool. */
export type Question = {
  header: string
  question: string
  options: { label: string; description?: string }[]
  multiSelect: boolean
}

export type QueryOptions = {
  prompt: string
  abortController?: AbortController
  canUseTool?: (toolName: string, input: Record<string, unknown>) => Promise<PermissionResult>
  /** Answers back to AskUserQuestion — the picked option labels. */
  askUser?: (question: Question) => Promise<string[]>
}
