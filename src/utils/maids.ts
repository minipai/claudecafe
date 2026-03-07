import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'

export interface Maid {
  slug: string
  jaName: string
  enName: string
  title: string
  quote: string
  rawMd: string
}

function parseMaid(slug: string, raw: string): Maid {
  const { data, content } = matter(raw)

  return {
    slug,
    jaName: data.name ?? slug,
    enName: data.id ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    title: data.personality ?? '',
    quote: data.quote ?? '',
    rawMd: content,
  }
}

let maidsCache: Maid[] | null = null
const isDev = process.env.NODE_ENV !== 'production'

function getCafeDir(): string {
  return join(import.meta.dirname, '../../cafe')
}

export function getAllMaids(): Maid[] {
  if (maidsCache && !isDev) return maidsCache

  const dir = getCafeDir()
  const files = readdirSync(dir).filter(f => f.endsWith('.md')).sort()

  maidsCache = files.map(f => {
    const slug = f.replace('.md', '')
    const raw = readFileSync(join(dir, f), 'utf-8')
    return parseMaid(slug, raw)
  })

  return maidsCache
}

export function getMaid(name: string): Maid | undefined {
  return getAllMaids().find(m => m.slug === name || m.enName.toLowerCase() === name.toLowerCase())
}
