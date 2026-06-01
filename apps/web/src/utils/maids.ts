import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { loadContentDir } from './content.js'

// Persona definitions live in the `maids` workspace package. Resolve its
// directory from the manifest path so the lookup works both in dev (pnpm
// symlink) and in the Docker bundle (pnpm deploy copies it into node_modules).
const require = createRequire(import.meta.url)
const maidsDir = dirname(require.resolve('maids/package.json'))

export interface Maid {
  slug: string
  jaName: string
  enName: string
  title: string
  quote: string
  rawMd: string
}

const cache: { items: Maid[] | null } = { items: null }

function parseMaid(slug: string, data: Record<string, unknown>, content: string): Maid {
  return {
    slug,
    jaName: (data.name as string) ?? slug,
    enName: (data.id as string) ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    title: (data.personality as string) ?? '',
    quote: (data.quote as string) ?? '',
    rawMd: content,
  }
}

export function getAllMaids(): Maid[] {
  return loadContentDir(
    maidsDir,
    'maids',
    parseMaid,
    cache,
  )
}

export function getMaid(name: string): Maid | undefined {
  return getAllMaids().find(m => m.slug === name || m.enName.toLowerCase() === name.toLowerCase())
}
