import type { Report } from '@/agent'

export type { Expression } from '@/agent/expressions'

export type Phase = 'idle' | 'working' | 'done'

export type Whisper = {
  id: number
  text: string
  /** `thought` is the model reasoning out loud, `tool` is what it did, and
   * `master` is what the master just said — his own words, so the scene shows
   * them going in rather than swallowing them. */
  kind: 'tool' | 'thought' | 'master'
}

/** `event` rows are the things that happened between the lines — tools that
 * ran, permissions granted or refused, interruptions. */
export type ChatMessage = {
  id: number
  role: 'user' | 'assistant' | 'event' | 'boundary'
  content: string
  report?: Report
  detail?: string
  createdAt: number
  /** The tool call this row recorded, so its answer can be put with it. */
  toolId?: string
  /** What the tool answered — folded away until the master opens the row. */
  output?: string
  failed?: boolean
}
