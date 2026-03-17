import { join } from 'node:path'
import { loadContentDir } from './content.js'

export interface BlogPost {
  slug: string
  title: string
  date: string
  author: string
  content: string
}

const cache: { items: BlogPost[] | null } = { items: null }

function parsePost(slug: string, data: Record<string, unknown>, content: string): BlogPost {
  const date = data.date
  return {
    slug: (data.slug as string) ?? slug,
    title: (data.title as string) ?? slug,
    date: date instanceof Date ? date.toISOString().slice(0, 10) : date ? String(date).slice(0, 10) : '',
    author: (data.author as string) ?? '',
    content,
  }
}

export function getAllPosts(): BlogPost[] {
  const posts = loadContentDir(
    join(import.meta.dirname, '../../blog'),
    'blog',
    parsePost,
    cache,
  )
  // newest first
  posts.sort((a, b) => b.date.localeCompare(a.date))
  return posts
}

export function getPost(slug: string): BlogPost | undefined {
  return getAllPosts().find(p => p.slug === slug)
}
