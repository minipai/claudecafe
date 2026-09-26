import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { parsePersona, personaFiles } from "./character-core/index.ts"
import { cafeRoot } from "./root.ts"

const unzip = promisify(execFile)

export const PUBLISHED_CHARACTER_PACKS = [
  {
    id: "kotone",
    version: "1.2.1",
    url: "https://github.com/minipai/claudecafe/releases/download/kotone-characters-v1.2.1/ClaudeCafe-Kotone-characters-v1.2.1.zip",
    sha256: "ed832f09fb47467828c19052ce1f99c6b908d6d7408ce39b873e076850e9ee5a",
  },
  {
    id: "kurumi",
    version: "1.2.1",
    url: "https://github.com/minipai/claudecafe/releases/download/kurumi-characters-v1.2.1/ClaudeCafe-Kurumi-characters-v1.2.1.zip",
    sha256: "8ea8016e94d24ca5b0851f1b9e2b2d72fbdaee275b4bbfa1eaa49f7044b4db68",
  },
  {
    id: "kokona",
    version: "1.2.0",
    url: "https://github.com/minipai/claudecafe/releases/download/kokona-characters-v1.2.0/ClaudeCafe-Kokona-characters-v1.2.0.zip",
    sha256: "7ac9cf0369c6d990eb8e02101d1f369df40f9024551363c3bc421a7f0df59773",
  },
] as const

export type Character = {
  id: string
  name: string
  personaPath: string
  pixelsDir: string | null
}

export function charactersDir(): string {
  return join(cafeRoot(), "characters")
}

export function personaFileInCharacters(id: string, variant = ""): string | null {
  return personaFileInFolder(charactersDir(), id, variant)
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

export function characterForId(id: string, variant = ""): Character | null {
  const personaPath = personaFileInCharacters(id, variant)
  if (!personaPath) return null
  const pixels = join(charactersDir(), id, "pixels")
  return {
    id,
    name: parsePersona(read(personaPath)).name || id,
    personaPath,
    pixelsDir: existsSync(pixels) ? pixels : null,
  }
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

function personaFileInFolder(root: string, id: string, variant = ""): string | null {
  if (!validId(id)) return null
  for (const file of personaFiles(variant)) {
    const path = join(root, id, file)
    if (existsSync(path)) return path
  }
  return null
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
