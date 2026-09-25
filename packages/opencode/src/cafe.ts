import {
  commitAuthorship as coreCommitAuthorship,
  fillPrompt,
  parsePersona,
  personaBody as corePersonaBody,
  resolveMaid as coreResolveMaid,
} from "./character-core/index.ts"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { characterForId, characterIds, personaFileInCharacters, type Character } from "./characters.ts"
import { expressionPrompt } from "./expressions.ts"
import { cafeRoot, expandHome } from "./root.ts"

export { cafeRoot } from "./root.ts"

/**
 * Claude Café's liveliness layer, ported to OpenCode.
 *
 * The state lives in the same shared root as the Claude Code plugin
 * (`$XDG_CONFIG_HOME/claudecafe`), so one `config.json`, the downloaded
 * `characters/` packs, and the legacy `personas/` pool serve every host: hire a
 * maid once and every agent has her.
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
// Personas: a character folder or a flat <id>.md file, frontmatter included.
// ---------------------------------------------------------------------------

/** The persona instructions: the file minus its YAML frontmatter. */
export function personaBody(path: string): string {
  return corePersonaBody(read(path))
}

/** A frontmatter-only stub (a retirement) still lets an explicit pick load her, so it never shadows the bundled maid. */
export function personaFile(maidID: string): string | null {
  const flat = join(personasDir(), `${maidID}.md`)
  if (existsSync(flat) && personaBody(flat).trim()) return flat

  const packed = personaFileInCharacters(maidID, lang())
  if (packed && personaBody(packed).trim()) return packed

  const bundled = join(maidsDir(), `${maidID}.md`)
  return existsSync(bundled) && personaBody(bundled).trim() ? bundled : null
}

/** The active persona plus the artwork belonging to the same local character id. */
export function characterForMaid(maidID: string): Character | null {
  const personaPath = personaFile(maidID)
  if (!personaPath) return null
  const packed = characterForId(maidID, lang())
  if (packed?.personaPath === personaPath) return packed
  const name = /^name:[ \t]*(.+)$/m.exec(read(personaPath))?.[1]?.trim().replace(/^(['"])(.*)\1$/, "$2")
  return {
    id: maidID,
    name: name || maidID,
    personaPath,
    pixelsDir: packed?.pixelsDir ?? null,
  }
}

/** True when the frontmatter says off_duty: she sits out the random draw. */
export function offDuty(body: string): boolean {
  return parsePersona(body).offDuty
}

/** The ids a draw may pick from; the user's folder comes first, so a same-id file wins. */
export function drawFrom(dirs: string[], extraIDs: string[] = []): string[] {
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
  for (const id of extraIDs) {
    if (pool.has(id)) continue
    const path = personaFileInCharacters(id, lang())
    if (path) pool.set(id, path)
  }
  return [...pool.entries()]
    .filter(([, path]) => !offDuty(read(path)))
    .map(([id]) => id)
    .sort()
}

/** The hired maids; while there are none, the bundled nameless maid keeps the place open. */
export function castPool(): string[] {
  const hired = drawFrom([personasDir()], characterIds())
  if (hired.length || config().builtin_cast === false) return hired
  return drawFrom([personasDir(), maidsDir()], characterIds())
}

/** Every selectable persona, including an explicit off-duty or nameless maid. */
export function availableCharacters(): Character[] {
  const ids = new Set(characterIds())
  for (const dir of [personasDir(), maidsDir()]) {
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".md")) continue
        const id = file.slice(0, -3)
        if (id === id.toLowerCase()) ids.add(id)
      }
    } catch {
      // A missing flat directory is normal.
    }
  }
  return [...ids]
    .sort()
    .map((id) => characterForMaid(id))
    .filter((character): character is Character => character !== null)
}

/**
 * The persona body with the configured Git attribution for a Café maid. A maid
 * hired from claudecafe.dev (id claudecafe/<slug>) signs commits as
 * `<name> <<slug>@claudecafe.dev>`, both read from her frontmatter; one shared
 * config chooses whether she is author or co-author. The `## Git` section older
 * downloads still carry gives way to it. Custom personas are left alone.
 */
export function commitAuthorship(text: string): string {
  return coreCommitAuthorship(text, String(config().commit_authorship ?? "co-author"))
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
  return fillPrompt(read(join(promptsDir(), `${template}.md`)), values)
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
 * Shift order: this session's explicit picker choice > OPENCODE_MAID/CLAUDE_MAID
 * env (a one-shot override) > the persisted draw > config "maid" > a draw from
 * the pool. "none" means nobody on shift: no persona, but the liveliness still
 * runs.
 */
function resolveMaid(sessionID?: string): string | null {
  const selected = sessionID ? read(join(stateDir(sessionID, false), "selected-maid")).trim() : ""
  const env = firstEnv("OPENCODE_MAID", "CLAUDE_MAID")
  const shift = sessionID ? read(join(stateDir(sessionID, false), "on-shift")).trim() : ""
  const configured = String(config().maid ?? "").trim()
  const requested = selected || env || shift || configured
  const maid = coreResolveMaid({
    selected,
    env,
    shift,
    config: configured,
    pool: requested ? [] : castPool(),
  })
  if (!requested && maid && sessionID) writeFileSync(join(stateDir(sessionID), "on-shift"), maid, "utf8")
  return maid
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
      shift.persona = path ? commitAuthorship(read(path)).trim() : ""
      if (!shift.persona) shift.maid = null
    }
    // The briefing is housekeeping's counterpart, not part of the persona:
    // config "greeting": false silences it while the shift clock still ticks.
    if (config().greeting !== false) shift.greeting = await buildGreeting()
    return shift
  }

  return {
    async selectMaid(sessionID: string, requested: string): Promise<Character | null> {
      const maid = requested.trim().toLowerCase()
      if (maid !== "none" && !/^[a-z0-9][a-z0-9-]*$/.test(maid)) {
        throw new Error(`Invalid maid id: ${requested}`)
      }
      if (maid !== "none" && !personaFile(maid)) {
        throw new Error(`Maid not found: ${requested}`)
      }
      writeFileSync(join(stateDir(sessionID), "selected-maid"), maid, "utf8")
      shifts.delete(sessionID)
      greeted.delete(sessionID)
      return maid === "none" ? null : characterForMaid(maid)
    },

    async character(sessionID: string): Promise<Character | null> {
      const shift = await startShift(sessionID)
      return shift.maid ? characterForMaid(shift.maid) : null
    },

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
      blocks.push(expressionPrompt())
      blocks.push(nowLine(shift, directory))
      if (!greeted.has(sessionID)) {
        greeted.add(sessionID)
        if (shift.greeting) blocks.push(shift.greeting)
      }
      if (blocks.length) input.system.push({ type: "text", text: blocks.join("\n\n") })
    },
  }
}
