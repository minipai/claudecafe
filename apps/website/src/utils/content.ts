import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'

const isDev = process.env.NODE_ENV !== 'production'

export function loadContentDir<T>(
  dir: string,
  label: string,
  parse: (slug: string, data: Record<string, unknown>, content: string, raw: string) => T,
  cache: { items: T[] | null },
): T[] {
  if (cache.items && !isDev) return cache.items

  let files: string[]
  try {
    files = readdirSync(dir).filter(f => /^[a-z0-9].*\.md$/.test(f)).sort()
  } catch {
    console.error(`[${label}] cannot read directory: ${dir}`)
    return []
  }

  cache.items = files.map(f => {
    const slug = f.replace(/\.md$/, '')
    const raw = readFileSync(join(dir, f), 'utf-8')
    const { data, content } = matter(raw)
    return parse(slug, data as Record<string, unknown>, content, raw)
  })

  return cache.items
}
