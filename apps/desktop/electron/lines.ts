import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { chosenSpeech } from './history'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Lines } from '../src/agent/bridge'

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
  try {
    const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude/cafe/config.json'), 'utf8'))
    const lang = String(config.lang ?? '').trim()
    if (lang) return lang
  } catch {
    // no café config: she speaks the plugin's default, which is English
  }
  return 'English'
}

/** Her lines in this language, if the window already has them. English needs no
 * asking — it is the copy the app ships with. */
export function knownLines(language: string): Lines | null {
  if (isEnglish(language)) return ENGLISH
  const kept = readKept()[language]
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
export async function askForLines(language: string, persona: string): Promise<Lines | null> {
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
    if (written) rememberLines(language, written)
    return written
  } catch {
    return null // nobody home: English stands
  }
}

/**
 * Her persona — the instructions that make the session ことね rather than an
 * assistant, and what the window's own lines have to sound like.
 *
 * A master who hired her from the café himself has his own copy of her, and
 * that is the one his terminal reads, so it is read here too: the maid in the
 * window and the maid in his terminal should not be two different drafts. The
 * app's own copy stands behind it, which is the whole of it on a machine that
 * has never heard of the café.
 */
export function personaOf(pluginRoot: string) {
  return bodyOf(path.join(personasDir(), 'kotone.md')) || bodyOf(path.join(pluginRoot, 'maids/kotone.md'))
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

function rememberLines(language: string, lines: Lines) {
  fs.writeFileSync(linesFile(), JSON.stringify({ ...readKept(), [language]: lines }, null, 2))
}

function readKept(): Record<string, Lines> {
  try {
    return JSON.parse(fs.readFileSync(linesFile(), 'utf8'))
  } catch {
    return {}
  }
}

const linesFile = () => path.join(app.getPath('userData'), 'lines.json')
