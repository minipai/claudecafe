import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'

export interface BlogPost {
  slug: string
  title: string
  date: string
  author: string
  content: string
}

function parsePost(slug: string, raw: string): BlogPost {
  const { data, content } = matter(raw)
  return {
    slug: data.slug ?? slug,
    title: data.title ?? slug,
    date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : data.date ? String(data.date).slice(0, 10) : '',
    author: data.author ?? '',
    content,
  }
}

let postsCache: BlogPost[] | null = null
const isDev = process.env.NODE_ENV !== 'production'

function getBlogDir(): string {
  return join(import.meta.dirname, '../../blog')
}

export function getAllPosts(): BlogPost[] {
  if (postsCache && !isDev) return postsCache

  const dir = getBlogDir()
  const files = readdirSync(dir).filter(f => f.endsWith('.md')).sort()

  postsCache = files.map(f => {
    const slug = f.replace('.md', '')
    const raw = readFileSync(join(dir, f), 'utf-8')
    return parsePost(slug, raw)
  })

  // newest first
  postsCache.sort((a, b) => b.date.localeCompare(a.date))
  return postsCache
}

export function getPost(slug: string): BlogPost | undefined {
  return getAllPosts().find(p => p.slug === slug)
}
