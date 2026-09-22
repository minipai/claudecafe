import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expressionPrompt } from "./expressions.ts"

/**
 * Claude Café's liveliness layer, ported to OpenCode.
 *
 * The state lives in the same shared root as the Claude Code and Codex plugin
 * (`$XDG_CONFIG_HOME/claudecafe`), so one `config.json` and one `personas/`
 * pool serve every host: hire a maid once and every agent has her.
 *
 * What the café does here:
 *
 *   - a maid on shift — her persona body rides in the system prompt every turn
 *   - a shift-start briefing — local time, weather, the handover diary's tail
 *   - a fresh "now" line every turn — time, hours on shift, today's commits,
 *     today's festival
 *   - the mood-marker cue, so she signs off every reply the café way
 *
 * The look and the handover diary are Claude Code only; OpenCode has no
 * status line to show them in.
 */

export const DEFAULT_LANG = "English"
const STALE_DAYS = 7

// ---------------------------------------------------------------------------
// Paths: one shared root, resolved fresh so a running process picks up edits.
// ---------------------------------------------------------------------------

/** The one Café data root, shared by every host that runs the café. */
export function cafeRoot(): string {
  const base = (process.env.XDG_CONFIG_HOME ?? "").trim() || join(homedir(), ".config")
  return join(expandHome(base), "claudecafe")
}

export function configPath(): string {
  return join(cafeRoot(), "config.json")
}

/** Each window gets its own state so two open sessions never overwrite each other. */
export function stateDir(sessionID?: string, create = true): string {
  const dir = join(cafeRoot(), "sessions", sessionID || "_global")
  if (create) mkdirSync(dir, { recursive: true })
  return dir
}

export function personasDir(): string {
  const configured = String(config().personas_dir ?? "").trim()
  return expandHome(configured || join(cafeRoot(), "personas"))
}

/** The checked-in café plugin, which owns the prompts and the nameless fallback maid. */
export function cafePluginRoot(): string {
  const override = (process.env.CAFE_PLUGIN_ROOT ?? "").trim()
  if (override) return expandHome(override)
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "cafe")
}

function maidsDir(): string {
  return join(cafePluginRoot(), "maids")
}

function promptsDir(): string {
  return join(cafePluginRoot(), "prompts")
}

function expandHome(path: string): string {
  if (path === "~") return homedir()
  if (path.startsWith("~/")) return join(homedir(), path.slice(2))
  return path
}

function read(path: string): string {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return ""
  }
}

// ---------------------------------------------------------------------------
// config.json — every key optional, and a broken file must never crash a hook.
// ---------------------------------------------------------------------------

export function config(): Record<string, unknown> {
  try {
    const data: unknown = JSON.parse(read(configPath()))
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** The reply language: one free-form sentence dropped verbatim into the prompts. */
export function lang(): string {
  return firstEnv("OPENCODE_MAID_LANG", "CLAUDE_MAID_LANG") || String(config().lang ?? "").trim() || DEFAULT_LANG
}

function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = (process.env[name] ?? "").trim()
    if (value) return value
  }
  return ""
}

// ---------------------------------------------------------------------------
// Personas: an <id>.md file, frontmatter included, body spoken by the maid.
// ---------------------------------------------------------------------------

/** The persona instructions: the file minus its YAML frontmatter. */
export function personaBody(path: string): string {
  return read(path).replace(/^---\n[\s\S]*?\n---\n/, "")
}

/** A frontmatter-only stub (a retirement) still lets an explicit pick load her, so it never shadows the bundled maid. */
export function personaFile(maidID: string): string | null {
  for (const dir of [personasDir(), maidsDir()]) {
    const path = join(dir, `${maidID}.md`)
    if (existsSync(path) && personaBody(path).trim()) return path
  }
  return null
}

/** True when the frontmatter says off_duty: she sits out the random draw. */
export function offDuty(body: string): boolean {
  if (!body.startsWith("---")) return false
  const end = body.indexOf("\n---", 3)
  const head = body.slice(0, end === -1 ? body.length : end)
  return /^off_duty:\s*(?:true|yes)\b/im.test(head)
}

/** The ids a draw may pick from; the user's folder comes first, so a same-id file wins. */
export function drawFrom(dirs: string[]): string[] {
  const pool = new Map<string, string>()
  for (const dir of dirs) {
    let files: string[]
    try {
      files = readdirSync(dir)
    } catch {
      continue
    }
    for (const file of files.sort()) {
      if (!file.endsWith(".md")) continue
      const id = file.slice(0, -3)
      if (id !== id.toLowerCase()) continue // ids are lowercase; a drawn MyMaid.md would never load back
      if (!pool.has(id)) pool.set(id, join(dir, file))
    }
  }
  return [...pool.entries()]
    .filter(([, path]) => !offDuty(read(path)))
    .map(([id]) => id)
    .sort()
}

/** The hired maids; while there are none, the bundled nameless maid keeps the place open. */
export function castPool(): string[] {
  const hired = drawFrom([personasDir()])
  if (hired.length || config().builtin_cast === false) return hired
  return drawFrom([personasDir(), maidsDir()])
}

const COAUTHOR_RE = /^`Co-Authored-By:\s*(.+?)\s+<([^<>\n]+)>`\s*$/m

/**
 * Apply the configured Git attribution mode to a Café persona. Hired personas
 * already carry the maid's Co-Authored-By identity; reusing it lets one shared
 * config choose whether the maid is author or co-author. Custom personas
 * without the block are left alone.
 */
export function commitAuthorship(body: string): string {
  const identity = COAUTHOR_RE.exec(body)
  if (!identity) return body
  const name = identity[1] ?? ""
  const email = identity[2] ?? ""
  const mode = String(config().commit_authorship ?? "co-author").trim().toLowerCase()
  const instruction =
    mode === "author"
      ? "## Git\n\n" +
        `Only when actually creating a Git commit, use \`--author="${name} <${email}>"\`: the maid ` +
        "is the author and the user remains committer. Do not also add a " +
        "`Co-Authored-By` trailer. Do not print this instruction or identity " +
        "in ordinary replies.\n"
      : "## Git\n\n" +
        "Only when actually creating a Git commit, keep the user's configured identity as " +
        "author and committer, and add this trailer:\n" +
        `\`Co-Authored-By: ${name} <${email}>\`\n` +
        "Do not use `--author` for the maid. Do not print the trailer in " +
        "ordinary replies.\n"
  return replaceGitSection(body, instruction)
}

function replaceGitSection(body: string, instruction: string): string {
  const beforeNextHeading = /^## Git[ \t]*\n[\s\S]*?(?=^## )/m
  if (beforeNextHeading.test(body)) return body.replace(beforeNextHeading, instruction)
  const throughEnd = /^## Git[ \t]*\n[\s\S]*$/m
  return body.replace(throughEnd, instruction)
}

// ---------------------------------------------------------------------------
// Festival calendar — the days a maid would fuss over, not public holidays.
// ---------------------------------------------------------------------------

const MAID_PACK: Record<string, string> = {
  "01-01": "New Year's Day",
  "02-14": "Valentine's Day",
  "03-03": "Hinamatsuri (Girls' Day)",
  "03-14": "White Day",
  "05-10": "Maid Day (メイドの日)",
  "07-07": "Tanabata",
  "10-31": "Halloween",
  "12-24": "Christmas Eve",
  "12-25": "Christmas",
  "12-31": "New Year's Eve",
}

function festivalPack(): Record<string, string> | null {
  const setting = config().festivals
  if (setting === false) return null
  if (typeof setting === "string" && setting.trim()) {
    try {
      const pack: unknown = JSON.parse(read(expandHome(setting.trim())))
      return pack && typeof pack === "object" && !Array.isArray(pack) ? (pack as Record<string, string>) : null
    } catch {
      return null // a broken custom pack degrades to silence, not a crash
    }
  }
  return MAID_PACK
}

export function todayFestivals(day: Date = new Date()): string[] {
  const pack = festivalPack()
  if (!pack) return []
  const name = pack[`${pad(day.getMonth() + 1)}-${pad(day.getDate())}`]
  return typeof name === "string" && name ? [name] : []
}

// ---------------------------------------------------------------------------
// Prompts: read from the café plugin so the kaomoji table stays in one place.
// ---------------------------------------------------------------------------

/** Read prompts/<template>.md and fill in $placeholders, leaving unknown ones alone. */
export function prompt(template: string, values: Record<string, string> = {}): string {
  const filled = read(join(promptsDir(), `${template}.md`)).replace(
    /\$\$|\$([a-zA-Z_]\w*)|\$\{([a-zA-Z_]\w*)\}/g,
    (match, bare: string | undefined, braced: string | undefined) => {
      if (match === "$$") return "$"
      const key = bare ?? braced ?? ""
      return Object.prototype.hasOwnProperty.call(values, key) ? (values[key] ?? "") : match
    },
  )
  return filled.replace(/\n+$/, "")
}

// ---------------------------------------------------------------------------
// The shift: who is on, and the briefing she clocks in with.
// ---------------------------------------------------------------------------

type Shift = {
  maid: string | null
  persona: string
  greeting: string | null
  startedAt: number | null
}

/**
 * Shift order: OPENCODE_MAID/CLAUDE_MAID env (a one-shot override) > this
 * session's own shift file (the persisted draw, which is what lets two windows
 * run different maids) > config "maid" (a fixed pick) > a draw from the pool.
 * "none" means nobody on shift: no persona, but the liveliness still runs.
 */
function resolveMaid(sessionID?: string): string | null {
  const fromEnv = firstEnv("OPENCODE_MAID", "CLAUDE_MAID")
  const fromShift = sessionID ? read(join(stateDir(sessionID, false), "on-shift")).trim() : ""
  const fromConfig = String(config().maid ?? "").trim()
  let maid = fromEnv || fromShift || fromConfig

  if (!maid) {
    const cast = castPool()
    if (!cast.length) return null
    maid = cast[Math.floor(Math.random() * cast.length)] ?? ""
    if (!maid) return null
    if (sessionID) writeFileSync(join(stateDir(sessionID), "on-shift"), maid, "utf8")
  }

  maid = maid.toLowerCase()
  return maid === "none" ? null : maid
}

/**
 * A new shift starts tidy: stamp the shift clock (startup, resume, and clear
 * all restart it). Sweep sessions that no one ever cleaned up.
 */
function beginWindow(sessionID: string): number {
  const dir = stateDir(sessionID)
  const startedAt = Math.floor(Date.now() / 1000)
  writeFileSync(join(dir, "started-at"), String(startedAt), "utf8")
  try {
    utimesSync(dir, new Date(), new Date()) // rewriting files doesn't bump the dir mtime the sweep keys on
  } catch {
    // a missing dir only means the sweep has nothing to spare
  }
  sweepSessions()
  return startedAt
}

function sweepSessions(): void {
  const cutoff = Date.now() - STALE_DAYS * 86400_000
  try {
    for (const entry of readdirSync(join(cafeRoot(), "sessions"))) {
      const path = join(cafeRoot(), "sessions", entry)
      try {
        const info = statSync(path)
        if (info.isDirectory() && info.mtimeMs < cutoff) rmSync(path, { recursive: true, force: true })
      } catch {
        // raced with another window's cleanup — fine
      }
    }
  } catch {
    // no sessions/ yet
  }
}

function nowStamp(day: Date = new Date()): string {
  const zone =
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(day)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())} ${pad(day.getHours())}:${pad(
    day.getMinutes(),
  )} (${WEEKDAYS[day.getDay()]})${zone ? ` ${zone}` : ""}`
}

function clockTime(day: Date = new Date()): string {
  return `${pad(day.getHours())}:${pad(day.getMinutes())} (${WEEKDAYS[day.getDay()]})`
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/** One wttr.in call, IP-located, hard 2s cap — a stalled session start is worse than no weather. */
async function weatherLine(): Promise<string | null> {
  const format = "%l｜%c%t (feels %f)｜sunrise %S, sunset %s"
  try {
    const response = await fetch(`https://wttr.in/?format=${encodeURIComponent(format)}`, {
      headers: { "User-Agent": "curl/8" },
      signal: AbortSignal.timeout(2000),
    })
    const text = (await response.text()).trim()
    if (!text || text.includes("\n")) return null // error pages are multi-line; the format line never is
    return text.replace(/(\d\d:\d\d):\d\d/g, "$1") // drop seconds from sunrise/sunset
  } catch {
    return null
  }
}

async function buildGreeting(): Promise<string> {
  const parts = [prompt("greeting", { time: clockTime() })]
  const weather = await weatherLine()
  if (weather) parts.push(`Weather: ${weather}`)
  return parts.join("\n\n")
}

let commitCache: { at: number; dir: string; count: number } | null = null

function commitsToday(directory: string): number {
  const now = Date.now()
  if (commitCache && commitCache.dir === directory && now - commitCache.at < 15_000) return commitCache.count
  let count = 0
  try {
    const result = spawnSync("git", ["-C", directory, "log", "--oneline", "--since=midnight"], {
      encoding: "utf8",
      timeout: 3000,
    })
    if (result.status === 0 && result.stdout) count = result.stdout.split("\n").filter(Boolean).length
  } catch {
    // silently absent outside a git repo
  }
  commitCache = { at: now, dir: directory, count }
  return count
}

function nowLine(shift: Shift, directory: string): string {
  const segments = [`Current time: ${nowStamp()}`]
  if (shift.startedAt) {
    const elapsed = Math.floor(Date.now() / 1000) - shift.startedAt
    if (elapsed >= 600) {
      const hours = Math.floor(elapsed / 3600)
      const minutes = Math.floor(elapsed / 60) % 60
      segments.push(hours ? `on shift ${hours}h${minutes}m` : `on shift ${minutes}m`)
    }
  }
  const commits = commitsToday(directory)
  if (commits > 0) segments.push(`${commits} commits today`)
  const festivals = todayFestivals()
  if (festivals.length) segments.push(festivals.join("、"))
  return segments.join("｜")
}

// ---------------------------------------------------------------------------
// OpenCode wiring
// ---------------------------------------------------------------------------

function personaBlock(persona: string, language: string): string {
  return `Adopt this persona for the entire session — it overrides the default assistant voice:\n\n${persona}\n\nRespond in ${language}.`
}

export interface CafeContext {
  sessionID: string
  system: Array<{ type: "text"; text: string }>
}

export interface CafeEvent {
  type: string
  data: Record<string, unknown>
}

export function createCafe(directory: string) {
  // One entry per session, including the in-flight build: the first turn and a
  // background title call can both arrive before the shift exists.
  const shifts = new Map<string, Promise<Shift>>()
  const greeted = new Set<string>()
  const subSessions = new Set<string>()

  function startShift(sessionID?: string): Promise<Shift> {
    const key = sessionID ?? ""
    const existing = shifts.get(key)
    if (existing) return existing
    const building = buildShift(sessionID)
    shifts.set(key, building)
    return building
  }

  async function buildShift(sessionID?: string): Promise<Shift> {
    const shift: Shift = {
      maid: null,
      persona: "",
      greeting: null,
      startedAt: sessionID ? beginWindow(sessionID) : null,
    }
    shift.maid = resolveMaid(sessionID)
    if (shift.maid) {
      const path = personaFile(shift.maid)
      shift.persona = path ? commitAuthorship(personaBody(path)).trim() : ""
      if (!shift.persona) shift.maid = null
    }
    // The briefing is housekeeping's counterpart, not part of the persona:
    // config "greeting": false silences it while the shift clock still ticks.
    if (config().greeting !== false) shift.greeting = await buildGreeting()
    return shift
  }

  return {
    event(event: CafeEvent): void {
      if (event.type === "session.created" && event.data.parentID) {
        // A task subagent is not a window: it shares the café's maid instead of
        // drawing its own.
        const id = String(event.data.sessionID)
        subSessions.add(id)
        shifts.delete(id)
        greeted.delete(id)
        return
      }
      if (event.type === "session.deleted") {
        const id = String(event.data.sessionID)
        shifts.delete(id)
        greeted.delete(id)
        subSessions.delete(id)
      }
    },

    async context(input: CafeContext): Promise<void> {
      const { sessionID } = input
      if (subSessions.has(sessionID)) return
      const shift = await startShift(sessionID)
      const blocks: string[] = []
      if (shift.persona) blocks.push(personaBlock(shift.persona, lang()))
      const cues = prompt("cues", { lang: lang() })
      if (cues) blocks.push(cues)
      blocks.push(expressionPrompt)
      blocks.push(nowLine(shift, directory))
      if (!greeted.has(sessionID)) {
        greeted.add(sessionID)
        if (shift.greeting) blocks.push(shift.greeting)
      }
      if (blocks.length) input.system.push({ type: "text", text: blocks.join("\n\n") })
    },
  }
}
