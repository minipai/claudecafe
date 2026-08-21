import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { REPORT_TOOL } from './tools'
import { describeTool, FALLBACK_LABEL, hasShape, isLongForm, openingLine } from './translate'
import type { BacklogLine, Backdrop, KeptSettings, Shift } from '../src/agent/bridge'

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
      try {
        return [{ sessionId: name.replace(/\.jsonl$/, ''), opening, at: fs.statSync(file).mtimeMs }]
      } catch {
        return [] // gone between reading it and stamping it
      }
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

/**
 * Where she was left standing. She is a figure on the desktop, not a document
 * window: the master puts her somewhere for a reason, and a maid who marches
 * back to the middle of the screen every morning is one he has to move again.
 */
export function rememberBounds(bounds: Electron.Rectangle) {
  fs.writeFileSync(boundsFile(), JSON.stringify(bounds, null, 2))
}

export function lastBounds(): Electron.Rectangle | null {
  try {
    const saved = JSON.parse(fs.readFileSync(boundsFile(), 'utf8'))
    const measured = ['x', 'y', 'width', 'height'].every((side) => typeof saved?.[side] === 'number')
    return measured ? saved : null
  } catch {
    return null // never placed, or the note was cleared out
  }
}

/**
 * Which language the interface is drawn in — `system` to follow the machine.
 * This is a code, not a sentence: it picks one of the translations the app
 * ships. What she *speaks* is the café's own setting and is nothing to do
 * with this one.
 */
export function rememberLocale(choice: string) {
  fs.writeFileSync(localeFile(), JSON.stringify({ locale: choice }, null, 2))
}

export function chosenLocale(): string {
  try {
    return String(JSON.parse(fs.readFileSync(localeFile(), 'utf8')).locale || 'system')
  } catch {
    return 'system'
  }
}

/**
 * What she should reply in, when the window is told rather than left to the
 * café's own setting. Free text: it is dropped into her instructions as it
 * stands, so "Japanese" and "繁體中文（台灣用語）" work the same way. Empty
 * means the window keeps out of it — the master's terminal maid and this one
 * then speak the same language, which is the sane default.
 */
export function rememberSpeech(language: string) {
  fs.writeFileSync(speechFile(), JSON.stringify({ language }, null, 2))
}

export function chosenSpeech(): string {
  try {
    return String(JSON.parse(fs.readFileSync(speechFile(), 'utf8')).language || '')
  } catch {
    return ''
  }
}

/**
 * What is standing behind her — which room, and how its picture is cut off at
 * the edges. Two names, not one: the scenes are ordinary rectangles and the
 * shape is decided over the top of whichever one is up, so changing the room
 * must not throw away the edge that was chosen for it.
 *
 * Unset is the window as it always looked: the one painted backdrop it shipped
 * with, drawn as it is.
 */
export function rememberBackdrop(chosen: Backdrop) {
  fs.writeFileSync(backdropFile(), JSON.stringify(chosen, null, 2))
}

export function chosenBackdrop(): Backdrop {
  try {
    const kept = JSON.parse(fs.readFileSync(backdropFile(), 'utf8')) as Partial<Backdrop>
    return {
      scene: typeof kept.scene === 'string' && kept.scene ? kept.scene : 'mucha',
      edge: typeof kept.edge === 'string' && kept.edge ? kept.edge : 'none',
    }
  } catch {
    return { scene: 'mucha', edge: 'none' }
  }
}

/**
 * Who is on shift in this window, and what she is wearing.
 *
 * Kept rather than drawn fresh: the café hands a terminal session a random maid
 * because a terminal is one shift among many, but this window is a thing on the
 * desktop that the master looks at, and something that looked different every
 * morning would read as the app having lost her.
 *
 * Read when a session opens, so handing the shift on takes effect at the next
 * conversation rather than mid-sentence — her persona is in the system prompt,
 * and there is no changing that under a session already running.
 */
export function rememberShift(shift: Shift) {
  fs.writeFileSync(shiftFile(), JSON.stringify(shift, null, 2))
}

export function chosenShift(): Shift {
  try {
    const kept = JSON.parse(fs.readFileSync(shiftFile(), 'utf8')) as Partial<Shift>
    return {
      maid: typeof kept.maid === 'string' && kept.maid ? kept.maid : DEFAULT_SHIFT.maid,
      outfit: typeof kept.outfit === 'string' && kept.outfit ? kept.outfit : DEFAULT_SHIFT.outfit,
    }
  } catch {
    return DEFAULT_SHIFT
  }
}

/** Who opens the café on a machine that has never been asked: the maid the
 * window was built around, in the clothes she works in. */
const DEFAULT_SHIFT: Shift = { maid: 'kotone', outfit: 'uniform' }

/**
 * Who served one conversation, written where the café's own hooks look it up.
 *
 * The window keeps one shift and the conversations keep none, so going back to
 * an old one used to hand it to whoever happens to be on now — she would read
 * the other maid's lines as her own, in the wrong face. The café plugin already
 * has a place for this, one folder per session under `~/.claude/cafe/`; it only
 * writes there when it draws a maid at random, and the window never draws. So
 * the window signs the same sheet, and gets to read every conversation back —
 * its own and the ones held in a terminal.
 */
export function rememberWhoServed(sessionId: string, maid: string) {
  // Never over a name already there. The window signs on every session it
  // opens, including a conversation it picked up rather than started — and the
  // maid who was actually asked those questions is the one worth keeping, or
  // the terminal the master left it in loses her for good.
  if (whoServed(sessionId)) return
  const sheet = shiftSheet(sessionId)
  if (!sheet) return
  try {
    fs.mkdirSync(sheet, { recursive: true })
    fs.writeFileSync(path.join(sheet, 'on-shift'), maid)
  } catch {
    // Read-only home, full disk. Worth nothing more than the shift not coming
    // back with this conversation later.
  }
}

export function whoServed(sessionId: string): string | null {
  const sheet = shiftSheet(sessionId)
  if (!sheet) return null
  try {
    return fs.readFileSync(path.join(sheet, 'on-shift'), 'utf8').trim() || null
  } catch {
    return null // held before the window wrote these, or by a plugin-less Claude Code
  }
}

/** Session ids come back off disk as filenames — the conversation list reads a
 * folder and strips `.jsonl` — so a file called `..jsonl` would otherwise walk
 * this one folder up and read, or write, the café's own state. */
function shiftSheet(sessionId: string) {
  if (sessionId !== path.basename(sessionId) || sessionId.startsWith('.')) return null
  return path.join(os.homedir(), '.claude/cafe/sessions', sessionId)
}

/**
 * What she runs as, as the master last set it — which model, how hard she
 * thinks, and how much she asks first. The window forgot all three every time
 * it was closed, which on a desktop app reads as it having forgotten rather
 * than as a fresh start.
 *
 * The asking mode is only written down once he has picked one *here*. Left
 * alone it stays null, and the session is opened without a mode at all: what
 * he set in his terminal then holds in the window too, the same way her
 * language does.
 */
export function rememberSettings(kept: KeptSettings) {
  fs.writeFileSync(settingsFile(), JSON.stringify(kept, null, 2))
}

export function keptSettings(): KeptSettings {
  try {
    const kept = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) as Partial<KeptSettings>
    return {
      model: typeof kept.model === 'string' && kept.model ? kept.model : null,
      // Hand-edited, or written by a version that offered something this one
      // does not: a value the SDK will not take opens nothing at all, so it is
      // read as never having been set rather than passed on.
      effort: EFFORTS.includes(kept.effort as Effort) ? (kept.effort as Effort) : null,
      mode: MODES.includes(kept.mode as Mode) ? (kept.mode as Mode) : null,
    }
  } catch {
    return { model: null, effort: null, mode: null }
  }
}

type Effort = NonNullable<KeptSettings['effort']>
type Mode = NonNullable<KeptSettings['mode']>
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
const MODES: Mode[] = ['default', 'auto', 'acceptEdits', 'plan', 'bypassPermissions', 'dontAsk']

/** How many folders the window keeps its own note of, and how many it offers. */
const FOLDER_LIMIT = 20
const OFFERED = 40

const foldersFile = () => path.join(app.getPath('userData'), 'folders.json')

const boundsFile = () => path.join(app.getPath('userData'), 'window.json')

const localeFile = () => path.join(app.getPath('userData'), 'locale.json')

const speechFile = () => path.join(app.getPath('userData'), 'speech.json')

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')

const backdropFile = () => path.join(app.getPath('userData'), 'backdrop.json')

const shiftFile = () => path.join(app.getPath('userData'), 'shift.json')

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
  // A row with no timestamp of its own belongs right where it was written,
  // not at "now" — the previous row's stamp is the nearest true thing.
  let lastAt = 0

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

    const at = Date.parse(row.timestamp ?? '') || lastAt
    lastAt = at
    const content = spokenText(row.message?.content)
    // A report is written into the call that handed it over, never into
    // anything she said — read only the text back and the whole write-up is
    // gone, with nothing on the row to open.
    const handed = reportHandedOver(row.message?.content)
    // How long a line is decides how it comes back, and the marker she signed
    // it with is not part of its length — measured with it on, a line either
    // side of the boundary comes back in a different shape than it was said in.
    const { said, marker } = withoutMood(content)
    if (handed) {
      lines.push({ role: 'assistant', content: content || handed.line, at, report: handed.report })
    } else if (row.type === 'assistant' && isLongForm(said)) {
      // Too long to say, and she never handed it over herself — the scene put
      // it in a panel and said one line of it, so that is how it comes back.
      lines.push({
        role: 'assistant',
        content: [openingLine(said), marker].filter(Boolean).join(' '),
        at,
        report: { label: FALLBACK_LABEL, body: said },
      })
    } else if (row.type === 'assistant' && hasShape(said)) {
      // She wrote this one out rather than said it, and it has to be laid out
      // again coming back: read as speech, its paragraphs and its list run
      // together into one wall of text.
      lines.push({ role: 'assistant', content, at, laidOut: true })
    } else if (content) {
      lines.push({ role: row.type, content, at })
    }
    // What she did between the lines is part of the record too — the live log
    // shows it as it happens, so a reopened one should not come back thinner.
    for (const used of toolsUsed(row.message?.content)) lines.push({ role: 'event', content: used, at })
  }
  return lines.slice(-BACKLOG_LIMIT)
}

/** The mood marker held apart from the words: it is what her face is read off
 * coming back, so it is kept on the line, but it is not what the line says. */
function withoutMood(text: string) {
  const marker = text.match(/【[^【】]*】\s*$/)
  return { said: (marker ? text.slice(0, marker.index) : text).trim(), marker: marker ? marker[0] : '' }
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
  if (wrapsInTranscriptTag(trimmed) || /^\(Output language/.test(trimmed)) return ''
  return trimmed
}

/** The wrapper tags Claude Code itself writes into a transcript — a slash
 * command's name, a background task's notice, a hook's stdout — none of them
 * anything the master typed. Matched by name rather than by shape, so a line
 * he actually wrote that happens to start with `<div>` is not mistaken for one. */
const TRANSCRIPT_WRAPPER_TAGS = new Set([
  'command-name',
  'command-message',
  'command-args',
  'local-command-stdout',
  'local-command-stderr',
  'bash-input',
  'bash-stdout',
  'bash-stderr',
  'task-notification',
  'task-id',
])

function wrapsInTranscriptTag(trimmed: string) {
  const opening = trimmed.match(/^<([a-z-]+)>/)
  return opening !== null && TRANSCRIPT_WRAPPER_TAGS.has(opening[1])
}

/**
 * The write-up she handed over on this row, if she handed one over. She writes
 * the body into the call itself and says nothing of it out loud, so the tool
 * call is the only copy the transcript keeps.
 */
function reportHandedOver(content: string | Block[] | undefined) {
  if (typeof content === 'string' || !content) return null
  const handing = content.find((block) => block.type === 'tool_use' && block.name === REPORT_TOOL)
  if (!handing) return null
  const written = handing.input ?? {}
  const body = String(written.body ?? '')
  if (!body) return null
  return {
    line: String(written.line ?? ''),
    report: { label: String(written.label ?? '') || FALLBACK_LABEL, body },
  }
}

/** Her tool calls, described the same way the live log describes them. */
function toolsUsed(content: string | Block[] | undefined) {
  if (typeof content === 'string' || !content) return []
  return content
    .filter((block) => block.type === 'tool_use' && block.name)
    .map((block) => describeTool(block.name!, block.input ?? {}))
}
