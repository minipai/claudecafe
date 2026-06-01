import { join } from 'node:path'
import { loadContentDir } from './content.js'

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
    join(import.meta.dirname, '../../cafe'),
    'maids',
    parseMaid,
    cache,
  )
}

export function getMaid(name: string): Maid | undefined {
  return getAllMaids().find(m => m.slug === name || m.enName.toLowerCase() === name.toLowerCase())
}
