export type Expression = 'neutral' | 'focused' | 'happy'

export type Phase = 'idle' | 'working' | 'done'

export type Whisper = {
  id: number
  text: string
  /** `thought` is the model reasoning out loud; `tool` is what it did. */
  kind: 'tool' | 'thought'
}

/** `event` rows are the things that happened between the lines — tools that
 * ran, permissions granted or refused, interruptions. */
export type ChatMessage = {
  id: number
  role: 'user' | 'assistant' | 'event' | 'boundary'
  content: string
  report?: string
  detail?: string
  createdAt: number
}
