import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { describeTool } from './translate'
import type { BacklogLine } from '../src/agent/bridge'

/**
 * Which conversation this window is on, and what was said in it.
 *
 * The window remembers its own session id rather than picking the newest
 * transcript in the folder: the café plugin shoots the maid's look by running
 * a throwaway session in the same folder, and those land in the same place.
 * The transcript itself is Claude Code's, under ~/.claude/projects/<folder>/ —
 * which is why the backlog survives a reload: it was never in the window.
 */
export function rememberSession(cwd: string, sessionId: string) {
  const seen = readMemory()
  if (seen[cwd] === sessionId) return
  seen[cwd] = sessionId
  fs.writeFileSync(memoryFile(), JSON.stringify(seen, null, 2))
}

export function forgetSession(cwd: string) {
  const seen = readMemory()
  delete seen[cwd]
  fs.writeFileSync(memoryFile(), JSON.stringify(seen, null, 2))
}

export function lastConversation(cwd: string): { sessionId: string; backlog: BacklogLine[] } | null {
  const sessionId = readMemory()[cwd]
  if (!sessionId) return null

  const file = path.join(
    os.homedir(),
    '.claude/projects',
    cwd.replace(/[^a-zA-Z0-9]/g, '-'),
    `${sessionId}.jsonl`,
  )
  try {
    return { sessionId, backlog: readBacklog(fs.readFileSync(file, 'utf8')) }
  } catch {
    return null // the transcript was cleared out from under us
  }
}

const memoryFile = () => path.join(app.getPath('userData'), 'sessions.json')

function readMemory(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(memoryFile(), 'utf8'))
  } catch {
    return {}
  }
}

/** How far back the window bothers to reopen. */
const BACKLOG_LIMIT = 60

function readBacklog(transcript: string): BacklogLine[] {
  const lines: BacklogLine[] = []

  for (const raw of transcript.split('\n')) {
    if (!raw.trim()) continue
    let row: Row
    try {
      row = JSON.parse(raw)
    } catch {
      continue
    }
    // Subagents talk in the same file; that is not the conversation the master had.
    if (row.isSidechain || row.isMeta) continue
    if (row.type !== 'user' && row.type !== 'assistant') continue

    const at = Date.parse(row.timestamp ?? '') || Date.now()
    const content = spokenText(row.message?.content)
    if (content) lines.push({ role: row.type, content, at })
    // What she did between the lines is part of the record too — the live log
    // shows it as it happens, so a reopened one should not come back thinner.
    for (const used of toolsUsed(row.message?.content)) lines.push({ role: 'event', content: used, at })
  }
  return lines.slice(-BACKLOG_LIMIT)
}

type Block = { type: string; text?: string; name?: string; input?: Record<string, unknown> }
type Row = {
  type?: string
  isSidechain?: boolean
  isMeta?: boolean
  timestamp?: string
  message?: { content?: string | Block[] }
}

/**
 * What was actually said. Tool calls and their results are the middle of the
 * work, not the conversation, and a turn made only of those has nothing to show.
 */
function spokenText(content: string | Block[] | undefined) {
  const text =
    typeof content === 'string'
      ? content
      : (content ?? [])
          .filter((block) => block.type === 'text')
          .map((block) => block.text ?? '')
          .join('\n')

  // Slash commands, hook output and the language preamble arrive wrapped in
  // tags or parentheses meant for the model, not for the master.
  // The mood marker stays: the log is what she wrote, and the face is the
  // scene's business.
  const trimmed = text.trim()
  if (/^<[a-z-]+>/.test(trimmed) || /^\(Output language/.test(trimmed)) return ''
  return trimmed
}

/** Her tool calls, described the same way the live log describes them. */
function toolsUsed(content: string | Block[] | undefined) {
  if (typeof content === 'string' || !content) return []
  return content
    .filter((block) => block.type === 'tool_use' && block.name)
    .map((block) => describeTool(block.name!, block.input ?? {}))
}
