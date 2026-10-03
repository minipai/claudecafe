import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { PUBLISHED_CHARACTER_PACKS, extendPersona, parsePersona } from "./character-core/index.ts"
import { cafeRoot } from "./root.ts"

const unzip = promisify(execFile)

export { PUBLISHED_CHARACTER_PACKS }

export type Character = {
  id: string
  name: string
  /** The persona text, with whatever it extends folded in. */
  persona: string
  pixelsDir: string | null
}

export function charactersDir(): string {
  return join(cafeRoot(), "characters")
}

export function personaFileInCharacters(id: string): string | null {
  return personaFileInFolder(charactersDir(), id)
}

export function characterIds(): string[] {
  try {
    return readdirSync(charactersDir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && validId(entry.name) && personaFileInCharacters(entry.name) !== null)
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

/** A character folder, its persona and art inherited from the characters it extends. */
export function characterForId(id: string): Character | null {
  const line = lineage(id)
  if (!line.length) return null
  const persona = line.map(({ text }) => text).reduceRight((parent, child) => extendPersona(child, parent))
  const pixels = line.map((ancestor) => join(charactersDir(), ancestor.id, "pixels")).find(existsSync)
  return {
    id,
    name: parsePersona(persona).name || id,
    persona,
    pixelsDir: pixels ?? null,
  }
}

/** The character and the ones it extends, nearest first; a missing parent or a cycle ends the line. */
function lineage(id: string): Array<{ id: string; text: string }> {
  const line: Array<{ id: string; text: string }> = []
  let next = id
  while (next && !line.some((ancestor) => ancestor.id === next)) {
    const path = personaFileInCharacters(next)
    if (!path) break
    const text = read(path)
    line.push({ id: next, text })
    next = parsePersona(text).extends
  }
  return line
}

export function characterVersion(id: string): string | null {
  const path = personaFileInCharacters(id)
  if (!path) return null
  return parsePersona(read(path)).version || null
}

export function shouldUpdateCharacter(current: string | null, published: string): boolean {
  if (!current) return true
  const currentParts = versionParts(current)
  const publishedParts = versionParts(published)
  if (!currentParts || !publishedParts) return current !== published
  for (let index = 0; index < publishedParts.length; index++) {
    if (currentParts[index] !== publishedParts[index]) return currentParts[index]! < publishedParts[index]!
  }
  return false
}

let syncInFlight: Promise<void> | undefined

/** Keep the three published packs current without making a network failure fatal. */
export function syncPublishedCharacters(): Promise<void> {
  if (syncInFlight) return syncInFlight
  const sync = Promise.allSettled(PUBLISHED_CHARACTER_PACKS.map(installPublishedCharacter))
    .then((results) => {
      for (const result of results) {
        if (result.status === "rejected") {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
          console.warn(`[claudecafe] character pack sync failed: ${reason}`)
        }
      }
    })
  syncInFlight = sync.finally(() => {
    syncInFlight = undefined
  })
  return syncInFlight
}

async function installPublishedCharacter(pack: (typeof PUBLISHED_CHARACTER_PACKS)[number]): Promise<void> {
  if (!shouldUpdateCharacter(characterVersion(pack.id), pack.version)) return

  const root = charactersDir()
  await mkdir(root, { recursive: true })
  const staging = await mkdtemp(join(root, `.${pack.id}-`))
  try {
    const response = await fetch(pack.url, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`${pack.id} download failed: HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    const digest = createHash("sha256").update(bytes).digest("hex")
    if (digest !== pack.sha256) throw new Error(`${pack.id} SHA-256 mismatch`)

    const archive = join(staging, `${pack.id}.zip`)
    await writeFile(archive, bytes)
    await unzip("unzip", ["-q", archive, "-d", staging])

    const extracted = join(staging, pack.id)
    const extractedPersona = personaFileInFolder(staging, pack.id)
    const extractedVersion = extractedPersona ? parsePersona(read(extractedPersona)).version : ""
    if (!extractedPersona || extractedVersion !== pack.version) {
      throw new Error(`${pack.id} archive has an unexpected persona version`)
    }
    if (!existsSync(join(extracted, "pixels", "neutral.gif"))) {
      throw new Error(`${pack.id} archive has no pixels/neutral.gif`)
    }
    await replaceDirectory(extracted, join(root, pack.id))
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

async function replaceDirectory(source: string, target: string): Promise<void> {
  const backup = `${target}.backup-${process.pid}-${Date.now()}`
  const hadTarget = existsSync(target)
  if (hadTarget) await rename(target, backup)
  try {
    await rename(source, target)
    if (hadTarget) await rm(backup, { recursive: true, force: true })
  } catch (error) {
    if (hadTarget && existsSync(backup) && !existsSync(target)) await rename(backup, target)
    throw error
  }
}

function personaFileInFolder(root: string, id: string): string | null {
  if (!validId(id)) return null
  const path = join(root, id, "persona.md")
  return existsSync(path) ? path : null
}

function validId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(id)
}

function read(path: string): string {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return ""
  }
}

function versionParts(version: string): number[] | null {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version.trim())
  if (!match) return null
  return [Number(match[1] ?? 0), Number(match[2] ?? 0), Number(match[3] ?? 0)]
}
