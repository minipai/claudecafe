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

interface PostFrontmatter {
  slug?: string
  title?: string
  date?: Date | string
  author?: string
}

function parsePost(slug: string, raw: string): BlogPost {
  const { data, content } = matter(raw)
  const fm = data as PostFrontmatter
  return {
    slug: fm.slug ?? slug,
    title: fm.title ?? slug,
    date: fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : fm.date ? String(fm.date).slice(0, 10) : '',
    author: fm.author ?? '',
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
  let files: string[]
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.md')).sort()
  } catch {
    console.error(`[blog] cannot read directory: ${dir}`)
    return []
  }

  postsCache = files.map(f => {
    const slug = f.replace(/\.md$/, '')
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
