import type { Report } from '@/agent'
import type { ChatMessage } from './types'

let chatMessageId = 0

export function createChatMessage(
  role: ChatMessage['role'],
  content: string,
  report?: Report,
  createdAt = Date.now(),
  detail?: string,
): ChatMessage {
  return {
    id: chatMessageId++,
    role,
    content,
    report,
    detail,
    createdAt,
  }
}

/** A notification is a glance, not a read: enough of her line to know what it
 * was about. */
export function shorten(line: string) {
  return line.length > 160 ? `${line.slice(0, 158)}…` : line
}

/**
 * What fits on a pill floating over the scene. A pasted page of text is still
 * one thing the master said, and put through whole it covers her — so it goes
 * up as its opening words, on one line.
 */
export function glance(text: string) {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 90 ? `${oneLine.slice(0, 88)}…` : oneLine
}

/** Her line as she wrote it: the mood marker belongs on the record, so it goes
 * on at the moment the line does — the box is the only place it comes off. */
export function signed(line: string, mood?: string) {
  return mood ? `${line} ${mood}` : line
}

export function createPreviewHistory(greeting: string) {
  const now = Date.now()
  return [
    createChatMessage('assistant', greeting, undefined, now - 10 * 60_000),
    createChatMessage('user', 'the status line is a bit hard to read — keep the model and the effort though', undefined, now - 8 * 60_000),
    createChatMessage('assistant', 'Done ♪ I raised the contrast, and lined the controls back up neatly.', undefined, now - 7 * 60_000),
    createChatMessage('user', 'can I read back over what we said earlier?', undefined, now - 3 * 60_000),
    createChatMessage('assistant', 'Of course — open LOG and the whole conversation is waiting there ♪', undefined, now - 2 * 60_000),
  ]
}

/** What a tool answered, put on the row that recorded the call. */
export function recordToolResult(
  messages: ChatMessage[],
  toolId: string,
  output: string,
  failed: boolean,
): ChatMessage[] {
  let at = messages.length - 1
  while (at >= 0 && messages[at].toolId !== toolId) at--
  if (at < 0) return messages
  const withResult = [...messages]
  withResult[at] = { ...messages[at], output, failed }
  return withResult
}
