import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { promisify } from 'node:util'
import { cafeRoot } from './cafehome'
import type { CastMember } from '../src/agent/bridge'

const characterPacks = [
  {
    id: 'kotone',
    url: 'https://github.com/minipai/claudecafe/releases/download/kotone-characters-v1.1.0/ClaudeCafe-Kotone-characters-v1.1.0.zip',
    sha256: '6fc7547085c95275e6348e1028f758fc6d26a353e8e061fa0086c84184ea04ef',
  },
  {
    id: 'kurumi',
    url: 'https://github.com/minipai/claudecafe/releases/download/kurumi-characters-v1.1.0/ClaudeCafe-Kurumi-characters-v1.1.0.zip',
    sha256: '248d5db8f02c75ac732cd401c021bd51bf4ed86b53c2ff9bd20c026b511e67af',
  },
  {
    id: 'kokona',
    url: 'https://github.com/minipai/claudecafe/releases/download/kokona-characters-v1.1.0/ClaudeCafe-Kokona-characters-v1.1.0.zip',
    sha256: '20d137453961f42d9b5c075fd287b80d140b779e4b469a28047a3e9e32228371',
  },
] as const
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
    const folder = path.join(directory, id)
    const persona = readPersona(folder)
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(persona)?.[1] ?? ''
    const name = /^name:[ \t]*(.+)$/m.exec(frontmatter)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2')
    const portraits = entries(path.join(folder, 'portraits'))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.webp'))
    if (!name || !portraits.some((entry) => entry.name === 'neutral.webp')) return []
    const url = (file: string) => `cafe-character://cast/${encodeURIComponent(id)}/${file}?v=${version}`
    return [{
      id,
      name,
      avatar: fs.existsSync(path.join(folder, 'avatar.webp')) ? url('avatar.webp') : url('portraits/neutral.webp'),
      expressions: Object.fromEntries(portraits.map((entry) => [entry.name.slice(0, -5), url(`portraits/${encodeURIComponent(entry.name)}`)])),
    }]
  }).sort((one, other) => one.id.localeCompare(other.id))
}

export function personaOf(maid: string) {
  if (!maid || !castOf().some((entry) => entry.id === maid)) return ''
  return readPersona(path.join(charactersDir(), maid)).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
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

function readPersona(folder: string) {
  for (const file of ['persona.zh.md', 'persona.en.md', 'persona.md']) {
    try {
      const content = fs.readFileSync(path.join(folder, file), 'utf8')
      if (content.trim()) return content
    } catch {
      // A character may provide only one language.
    }
  }
  return ''
}

function entries(directory: string) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }
}
