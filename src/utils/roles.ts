import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'

export interface Role {
  slug: string
  jaName: string
  enName: string
  title: string
  quote: string
  rawMd: string
  themeColor: string
}

const THEME_COLORS: Record<string, string> = {
  claudia: '#c25b56',
  codex: '#7b5ea7',
  kokona: '#e07b53',
  kotone: '#6b8e8e',
  kuroko: '#d4849e',
  kurumi: '#8bab6e',
}

function parseRole(slug: string, raw: string): Role {
  const { data, content } = matter(raw)

  return {
    slug,
    jaName: data.name ?? slug,
    enName: data.id ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    title: data.personality ?? '',
    quote: data.quote ?? '',
    rawMd: content,
    themeColor: THEME_COLORS[slug] || '#8b7355',
  }
}

let rolesCache: Role[] | null = null

function getRolesDir(): string {
  return join(import.meta.dirname, '../../roles')
}

export function getAllRoles(): Role[] {
  if (rolesCache) return rolesCache

  const dir = getRolesDir()
  const files = readdirSync(dir).filter(f => f.endsWith('.md')).sort()

  rolesCache = files.map(f => {
    const slug = f.replace('.md', '')
    const raw = readFileSync(join(dir, f), 'utf-8')
    return parseRole(slug, raw)
  })

  return rolesCache
}

export function getRole(name: string): Role | undefined {
  return getAllRoles().find(r => r.slug === name || r.enName.toLowerCase() === name.toLowerCase())
}
