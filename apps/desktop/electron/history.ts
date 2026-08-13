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
  const backlog = conversationBacklog(cwd, sessionId)
  return backlog ? { sessionId, backlog } : null
}

/** What was said in one conversation of this folder — the one the master picked
 * out of the list, or the one this window was already on. */
export function conversationBacklog(cwd: string, sessionId: string): BacklogLine[] | null {
  const file = path.join(
    os.homedir(),
    '.claude/projects',
    cwd.replace(/[^a-zA-Z0-9]/g, '-'),
    `${sessionId}.jsonl`,
  )
  try {
    return readBacklog(fs.readFileSync(file, 'utf8'))
  } catch {
    return null // the transcript was cleared out from under us
  }
}

/**
 * The conversations held in this folder, newest first. Claude Code keeps one
 * transcript per session, and the café plugin's own background runs land in the
 * same place — those never contain anything the master said, which is exactly
 * how they are told apart here.
 */
export function listConversations(cwd: string): Conversation[] {
  const folder = path.join(os.homedir(), '.claude/projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'))
  let files: string[]
  try {
    files = fs.readdirSync(folder).filter((name) => name.endsWith('.jsonl'))
  } catch {
    return [] // nothing has been said in this folder yet
  }

  return files
    .flatMap((name) => {
      const file = path.join(folder, name)
      const opening = firstThingSaid(file)
      if (!opening) return []
      return [{ sessionId: name.replace(/\.jsonl$/, ''), opening, at: fs.statSync(file).mtimeMs }]
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, CONVERSATION_LIMIT)
}

export type Conversation = { sessionId: string; opening: string; at: number }

/** How many conversations back the list goes. */
const CONVERSATION_LIMIT = 40

/** As much of a transcript as it takes to find the master's first words. A
 * session that opens with nothing of his in this much of it was not his. */
const SEARCHED = 256 * 1024

function firstThingSaid(file: string) {
  let head: string
  try {
    const handle = fs.openSync(file, 'r')
    const buffer = Buffer.alloc(SEARCHED)
    const read = fs.readSync(handle, buffer, 0, SEARCHED, 0)
    fs.closeSync(handle)
    head = buffer.toString('utf8', 0, read)
  } catch {
    return null
  }

  for (const raw of head.split('\n')) {
    if (!raw.trim()) continue
    let row: Row
    try {
      row = JSON.parse(raw)
    } catch {
      continue // the last line of the chunk, cut in half
    }
    if (row.type !== 'user' || row.isSidechain || row.isMeta) continue
    const said = spokenText(row.message?.content)
    if (said) return said.length > 120 ? `${said.slice(0, 118)}…` : said
  }
  return null
}

/**
 * The folders she has been opened on, most recent first. The window switches
 * between them in place — there is one of her, and she goes where she is sent.
 */
export function rememberFolder(cwd: string) {
  const seen = recentFolders().filter((folder) => folder !== cwd)
  fs.writeFileSync(foldersFile(), JSON.stringify([cwd, ...seen].slice(0, FOLDER_LIMIT), null, 2))
}

/**
 * Everywhere she could be sent: the folders this window has been on, and then
 * every project Claude Code itself has been used in — the master has worked in
 * dozens of them long before this app existed, and on a first run the window's
 * own list is just the folder it started in.
 */
export function recentFolders(): string[] {
  const visited = readVisited()
  const known = knownProjects().filter((folder) => !visited.includes(folder))
  return [...visited, ...known].slice(0, OFFERED)
}

function readVisited(): string[] {
  try {
    const folders = JSON.parse(fs.readFileSync(foldersFile(), 'utf8'))
    return Array.isArray(folders) ? folders.filter((folder) => typeof folder === 'string') : []
  } catch {
    return []
  }
}

/** Claude Code keeps a note per project it has been run in, and stamps each one
 * with when it last started there — which is the order they are worth offering
 * in. Ones that have since been moved or deleted are dropped. */
function knownProjects(): string[] {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'))
    const projects = (config.projects ?? {}) as Record<string, { lastStartTime?: string }>
    return Object.entries(projects)
      .sort(([, a], [, b]) => (Date.parse(b.lastStartTime ?? '') || 0) - (Date.parse(a.lastStartTime ?? '') || 0))
      .map(([folder]) => folder)
      .filter((folder) => fs.existsSync(folder))
  } catch {
    return []
  }
}

/** How many folders the window keeps its own note of, and how many it offers. */
const FOLDER_LIMIT = 20
const OFFERED = 40

const foldersFile = () => path.join(app.getPath('userData'), 'folders.json')

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
