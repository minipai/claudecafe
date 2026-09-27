import type { ChatMessage } from '../types'
import type { CompactBoundary } from '@/agent'
import { fill, text } from '@/i18n'

let chatMessageId = 0

/** Live and restored boundaries show only measurements supplied by Claude Code. */
export function compactDetail(compact?: CompactBoundary) {
  if (!compact) return undefined
  const t = text().log
  const parts = [compact.trigger ? t.compactTrigger[compact.trigger] : undefined]
  if (compact.preTokens !== undefined && compact.postTokens !== undefined) {
    parts.push(`${compact.preTokens} → ${compact.postTokens} ${t.tokens}`)
  } else if (compact.preTokens !== undefined) {
    parts.push(fill(t.compactBefore, { count: compact.preTokens }))
  } else if (compact.postTokens !== undefined) {
    parts.push(fill(t.compactAfter, { count: compact.postTokens }))
  }
  if (compact.durationMs !== undefined) parts.push(`${(compact.durationMs / 1000).toFixed(1)}s`)
  return parts.filter(Boolean).join(' · ') || undefined
}

export function createChatMessage(
  role: ChatMessage['role'],
  content: string,
  createdAt = Date.now(),
  detail?: string,
): ChatMessage {
  return {
    id: chatMessageId++,
    role,
    content,
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

export function createPreviewHistory(greeting: string) {
  const now = Date.now()
  return [
    createChatMessage('assistant', greeting, now - 10 * 60_000),
    createChatMessage('user', 'the status line is a bit hard to read — keep the model and the effort though', now - 8 * 60_000),
    createChatMessage('assistant', 'Done ♪ I raised the contrast, and lined the controls back up neatly.', now - 7 * 60_000),
    createChatMessage('user', 'can I read back over what we said earlier?', now - 3 * 60_000),
    createChatMessage('assistant', 'Of course — open LOG and the whole conversation is waiting there ♪', now - 2 * 60_000),
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

/** Keep one live assistant row per streamed text block as its snapshot grows. */
export function upsertStreamMessage(messages: ChatMessage[], streamId: string, content: string): ChatMessage[] {
  const index = messages.findIndex((message) => message.streamId === streamId)
  if (index < 0) return [...messages, { ...createChatMessage('assistant', content), streamId }]
  const next = [...messages]
  next[index] = { ...next[index], content }
  return next
}
