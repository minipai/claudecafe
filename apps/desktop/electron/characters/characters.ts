import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { promisify } from 'node:util'
import { PUBLISHED_CHARACTER_PACKS, extendPersona, parsePersona } from '@claudecafe/character-core'
import { cafeRoot } from './cafehome'
import type { CastMember } from '../../src/agent/bridge'

const characterPacks = PUBLISHED_CHARACTER_PACKS
const unzip = promisify(execFile)

/** Characters live beside the shared café settings, not in an app chooser. */
export const charactersDir = () => path.join(cafeRoot(), 'characters')

/** Install published maids once, leaving existing character folders alone. */
export async function installCharacters() {
  const results = await Promise.allSettled(characterPacks.map(installCharacter))
  return results.flatMap((result, index) => result.status === 'rejected'
    ? [`${characterPacks[index].id}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
    : [])
}

async function installCharacter(pack: typeof characterPacks[number]) {
  const root = charactersDir()
  const target = path.join(root, pack.id)
  if (castOf().some((maid) => maid.id === pack.id)) return
  if (fs.existsSync(target)) throw new Error(`Incomplete character folder at ${target}`)

  await fs.promises.mkdir(root, { recursive: true })
  const staging = await fs.promises.mkdtemp(path.join(root, `.${pack.id}-`))
  try {
    const response = await fetch(pack.url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)
    const archive = Buffer.from(await response.arrayBuffer())
    if (createHash('sha256').update(archive).digest('hex') !== pack.sha256) {
      throw new Error('Download did not match its published checksum')
    }

    const zip = path.join(staging, `${pack.id}.zip`)
    await fs.promises.writeFile(zip, archive)
    await unzip('unzip', ['-q', zip, '-d', staging])
    if (!castOf(staging).some((maid) => maid.id === pack.id)) throw new Error('Archive has no usable character')
    if (!fs.existsSync(target)) await fs.promises.rename(path.join(staging, pack.id), target)
  } finally {
    await fs.promises.rm(staging, { recursive: true, force: true })
  }
}

export function castOf(directory = charactersDir()): CastMember[] {
  if (!directory) return []
  const version = createHash('sha256').update(directory).digest('hex').slice(0, 16)
  return entries(directory).filter((entry) => entry.isDirectory()).flatMap(({ name: id }) => {
    const lineage = lineageOf(directory, id)
    const name = parsePersona(personaFrom(lineage)).name
    const art = lineage.find((maid) => fs.existsSync(path.join(directory, maid.id, 'portraits')))?.id ?? id
    const portraits = entries(path.join(directory, art, 'portraits'))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.webp'))
    if (!name || !portraits.some((entry) => entry.name === 'neutral.webp')) return []
    const url = (folder: string, file: string) => `cafe-character://cast/${encodeURIComponent(folder)}/${file}?v=${version}`
    const avatar = [id, art].find((folder) => fs.existsSync(path.join(directory, folder, 'avatar.webp')))
    return [{
      id,
      name,
      avatar: avatar ? url(avatar, 'avatar.webp') : url(art, 'portraits/neutral.webp'),
      expressions: Object.fromEntries(portraits.map((entry) => [entry.name.slice(0, -5), url(art, `portraits/${encodeURIComponent(entry.name)}`)])),
    }]
  }).sort((one, other) => one.id.localeCompare(other.id))
}

export function personaOf(maid: string) {
  if (!maid || !castOf().some((entry) => entry.id === maid)) return ''
  return parsePersona(personaFrom(lineageOf(charactersDir(), maid))).body.trim()
}

export function nameOf(maid: string) {
  return castOf().find((entry) => entry.id === maid)?.name ?? maid
}

/** Only artwork under the configured root is exposed to the renderer. */
export function characterImage(url: string): string | null {
  try {
    const requested = new URL(url)
    if (requested.hostname !== 'cast') return null
    const parts = requested.pathname.split('/').slice(1).map(decodeURIComponent)
    if (parts.some((part) => !part || part === '.' || part === '..' || /[/\\]/.test(part))) return null
    if (!(parts.length === 2 && parts[1] === 'avatar.webp') &&
        !(parts.length === 3 && parts[1] === 'portraits' && parts[2].endsWith('.webp'))) return null
    const directory = charactersDir()
    if (!directory) return null
    const root = fs.realpathSync(directory)
    const file = fs.realpathSync(path.join(root, ...parts))
    if (!file.startsWith(`${root}${path.sep}`)) return null
    return file
  } catch {
    return null
  }
}

/** A maid and the maids her persona extends, nearest first; a cycle or a missing parent ends the line. */
function lineageOf(directory: string, id: string) {
  const lineage = [{ id, persona: readPersona(path.join(directory, id)) }]
  let parent = parsePersona(lineage[0].persona).extends
  while (parent && !lineage.some((maid) => maid.id === parent)) {
    const persona = readPersona(path.join(directory, parent))
    if (!persona.trim()) break
    lineage.push({ id: parent, persona })
    parent = parsePersona(persona).extends
  }
  return lineage
}

/** Each persona in the line fills in what the one below it leaves blank. */
function personaFrom(lineage: { persona: string }[]) {
  return lineage.map((maid) => maid.persona).reduceRight((parent, child) => extendPersona(child, parent))
}

function readPersona(folder: string) {
  try {
    return fs.readFileSync(path.join(folder, 'persona.md'), 'utf8')
  } catch {
    return ''
  }
}

function entries(directory: string) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }
}
