import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { chosenSpeech } from './history'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { CastMember, Lines } from '../src/agent/bridge'

/**
 * The handful of lines the window puts in her mouth — the opening, the one she
 * says when she is stopped, the ones she asks permission with. The window has
 * to have them before there is a model to write them, so English is written
 * into the app; anything else she is asked to write once, in her own voice, and
 * it is kept.
 *
 * Nothing here interpolates: the command, the file and the plan are already on
 * the card next to her, and a sentence with a path wedged into it is a sentence
 * that cannot be translated without being rebuilt.
 */
const ENGLISH: Lines = {
  greeting: 'Goshujin-sama~ what can I do for you today? Ask away, or press ⌘K to send me somewhere else ♪',
  interrupted: 'Eh, stopping there? O-okay…',
  commandAsk: 'Goshujin-sama, I would like to run this — may I?',
  editAsk: 'I would like to change this file~ have a look at what I am changing first?',
  planAsk: 'The plan is laid out! Does this look right to Goshujin-sama?',
  errorTitle: 'I tripped over something…',
  waiting: [
    'Just a moment more~ ♡',
    'I am looking through this…',
    'Mm — almost there ♪',
    'This function is being a little difficult…',
    'Nearly done, Goshujin-sama ♡',
  ],
}

/**
 * What she is meant to reply in: what this window was told, and otherwise the
 * café plugin's own setting, read the same way the plugin reads it. Left alone,
 * she speaks in here exactly as she does in the master's terminal.
 */
export function replyLanguage() {
  // What the window was told, if anything: ⌘K sets this, and it is the only
  // language setting that belongs to the app rather than to the café.
  const told = chosenSpeech().trim()
  if (told) return told
  const said = process.env.CLAUDE_MAID_LANG?.trim()
  if (said) return said
  return cafeLanguage() || 'English'
}

/** The café's own setting, which is the master's terminal maid's language too.
 * Empty on a machine that has never heard of the café. */
function cafeLanguage() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude/cafe/config.json'), 'utf8'))
    return String(config.lang ?? '').trim()
  } catch {
    return '' // no café config
  }
}

/**
 * Whether anyone has ever said what she should speak. Nobody has on a machine
 * with neither a window setting nor a café one — and English is then a default
 * nobody chose, which is how a master who speaks something else ends up with a
 * maid answering him in the wrong language and nothing on screen saying where
 * that is changed. The window asks him instead, once.
 */
export function languageSettled() {
  return Boolean(chosenSpeech().trim() || process.env.CLAUDE_MAID_LANG?.trim() || cafeLanguage())
}

/** Her lines in this language, if the window already has them. English needs no
 * asking — it is the copy the app ships with. */
export function knownLines(maid: string, language: string): Lines | null {
  if (isEnglish(language)) return ENGLISH
  const kept = readKept()[maid]?.[language]
  // A note written before she had waiting lines is short of them, and English
  // ones under a maid speaking something else is not what was kept. Treating it
  // as unwritten is what gets her to write the missing ones in her own voice.
  return kept?.waiting?.length ? kept : null
}

/**
 * Ask her to write them. One short session of its own, run somewhere else
 * entirely: with no settings loaded it picks up none of the master's hooks, and
 * with a temporary folder as its cwd the transcript never turns up in the list
 * of conversations he had in his project.
 *
 * Null when there is no one to ask — signed out, offline. The window goes on in
 * English and asks again the next time it knows the session works.
 */
export async function askForLines(maid: string, language: string, persona: string): Promise<Lines | null> {
  try {
    const stream = query({
      prompt: writingBrief(language, persona),
      options: { cwd: os.tmpdir(), settingSources: [], allowedTools: [], maxTurns: 1 },
    })
    let answer = ''
    for await (const message of stream) {
      if (message.type === 'result' && message.subtype === 'success') answer = message.result
    }
    const written = readAnswer(answer)
    if (written) rememberLines(maid, language, written)
    return written
  } catch {
    return null // nobody home: English stands
  }
}

/**
 * The persona of whoever is on shift — the instructions that make the session
 * her rather than an assistant, and what the window's own lines have to sound
 * like.
 *
 * A master who hired her from the café himself has his own copy of her, and
 * that is the one his terminal reads, so it is read here first: the maid in the
 * window and the maid in his terminal should not be two different drafts. The
 * app's own copy stands behind it, which is the whole of it on a machine that
 * has never heard of the café.
 */
export function personaOf(pluginRoot: string, maid: string) {
  return maidFiles(pluginRoot, maid).map(bodyOf).find(Boolean) ?? ''
}

/**
 * Everyone with a persona the window could put on shift, named as their own
 * file names them.
 *
 * The window narrows this to the maids it carries artwork for, so what comes
 * back here is deliberately everything: the hired and the bundled together,
 * hers winning where both exist. A file with no name in it is nobody the master
 * could be shown, so it is left out rather than listed as its own filename.
 */
export function castOf(pluginRoot: string): CastMember[] {
  const found = new Map<string, CastMember>()
  for (const dir of [path.join(pluginRoot, 'maids'), personasDir()]) {
    for (const file of markdownIn(dir)) {
      const id = file.replace(/\.md$/, '')
      const front = frontmatterOf(path.join(dir, file))
      const name = /^name:[ \t]*(.+)$/m.exec(front)?.[1].trim()
      if (name) found.set(id, { id, name, outfits: outfitsIn(front) })
    }
  }
  return [...found.values()].sort((one, other) => one.id.localeCompare(other.id))
}

/** What to call whoever is on shift. Her id stands if she has no persona here
 * — that is a maid with artwork and nothing written, which the window would
 * rather name badly than leave the plate empty over. */
export function nameOf(pluginRoot: string, maid: string) {
  return castOf(pluginRoot).find((one) => one.id === maid)?.name ?? maid
}

/** The wording for her outfits, as an `outfits:` block of `<folder>: <name>`.
 * Only the maid's own author can write this, so a wardrobe drawn by somebody
 * else simply is not in here and the folder's name stands instead. */
function outfitsIn(front: string) {
  const block = /^outfits:[ \t]*\n((?:[ \t]+\S.*\n?)*)/m.exec(front)?.[1] ?? ''
  return [...block.matchAll(/^[ \t]+([\w-]+):[ \t]*(.+)$/gm)].map((line) => ({
    id: line[1],
    label: line[2].trim(),
  }))
}

/** Where a maid of this id might be written down, nearest first. */
function maidFiles(pluginRoot: string, maid: string) {
  return [path.join(personasDir(), `${maid}.md`), path.join(pluginRoot, 'maids', `${maid}.md`)]
}

function markdownIn(dir: string) {
  try {
    return fs.readdirSync(dir).filter((name) => name.endsWith('.md'))
  } catch {
    return [] // nothing hired, or no plugin staged beside the app
  }
}

/** Just the settings block at the top of a persona file — her name, and the
 * wording for what she has to wear. */
function frontmatterOf(file: string) {
  try {
    return /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? ''
  } catch {
    return ''
  }
}

function bodyOf(file: string) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').trim()
  } catch {
    return ''
  }
}

/** Where the master keeps the maids he has hired, as the café reads it. */
function personasDir() {
  const home = path.join(os.homedir(), '.claude/cafe')
  try {
    const config = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'))
    const told = String(config.personas_dir ?? '').trim()
    if (told) return told.replace(/^~(?=\/|$)/, os.homedir())
  } catch {
    // no café config: the default place, which may not exist either
  }
  return path.join(home, 'personas')
}

function writingBrief(language: string, persona: string) {
  return `${persona}

---

The maid above works inside a desktop window rather than a terminal. The window itself puts a few words in her mouth at moments when no model is answering. Write those lines, in ${language}, in her voice.

Return JSON and nothing else, with exactly these keys:

- "greeting": what she says as the window opens and whenever a fresh conversation starts. Mention that ⌘K is how she is sent to another folder or back to an earlier conversation.
- "interrupted": she has just been stopped in the middle of working.
- "commandAsk": she is asking to be allowed to run a shell command. The command itself is printed on the card beside her, so the line must not contain it or describe which one it is.
- "editAsk": she is asking to be allowed to change a file. The file name and the diff are shown beside her, so the line must not name the file.
- "planAsk": she has finished writing a plan and wants it looked over before she starts.
- "errorTitle": the title of a small failure notice — a few words, no sentence.
- "waiting": an array of five short things she says while she is off working and cannot answer yet — the master is watching a timer tick beside them. Nothing about what she is doing: the same five are shown whatever the work is. Keep each under about twenty characters.

One line each, the way she would actually say it. No quotes around the values other than JSON's own.`
}

export function readAnswer(answer: string): Lines | null {
  const body = answer.match(/\{[\s\S]*\}/)?.[0]
  if (!body) return null
  try {
    const written = JSON.parse(body) as Record<string, unknown>
    const spoken = SPOKEN.map((key) => [key, typeof written[key] === 'string' ? (written[key] as string) : ENGLISH[key]] as const)
    // The waiting lines are the one answer that is a list; a reply that gave
    // none of them keeps the English set rather than leaving her silent there.
    const waiting = Array.isArray(written.waiting)
      ? written.waiting.filter((line): line is string => typeof line === 'string' && line.trim() !== '')
      : []
    const lines: Lines = {
      ...(Object.fromEntries(spoken) as Omit<Lines, 'waiting'>),
      waiting: waiting.length ? waiting : ENGLISH.waiting,
    }
    // A reply that answered none of it is not worth keeping.
    return spoken.some(([key, line]) => line !== ENGLISH[key]) || waiting.length ? lines : null
  } catch {
    return null
  }
}

/** Every line she writes as one sentence — all of them but the waiting list. */
const SPOKEN = ['greeting', 'interrupted', 'commandAsk', 'editAsk', 'planAsk', 'errorTitle'] as const

export const englishLines = () => ENGLISH

const isEnglish = (language: string) => language.trim().toLowerCase() === 'english'

/** Kept per maid as well as per language: these are written in her voice, and
 * handing them to the next maid on shift would put her words in someone else's
 * mouth. */
function rememberLines(maid: string, language: string, lines: Lines) {
  const kept = readKept()
  fs.writeFileSync(linesFile(), JSON.stringify({ ...kept, [maid]: { ...kept[maid], [language]: lines } }, null, 2))
}

function readKept(): Record<string, Record<string, Lines>> {
  try {
    return JSON.parse(fs.readFileSync(linesFile(), 'utf8'))
  } catch {
    return {}
  }
}

const linesFile = () => path.join(app.getPath('userData'), 'lines.json')
