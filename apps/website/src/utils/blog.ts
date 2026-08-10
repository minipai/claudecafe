import { join } from 'node:path'
import { loadContentDir } from './content.js'
import type { Locale } from '../i18n.js'

export interface BlogPost {
  slug: string
  title: string
  date: string
  author: string
  content: string
}

const blogDir = join(import.meta.dirname, '../../blog')
const localeDirs: Record<Locale, string> = {
  zh: blogDir,
  en: join(blogDir, 'en'),
}

const caches: Record<Locale, { items: BlogPost[] | null }> = {
  zh: { items: null },
  en: { items: null },
}

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

export function getAllPosts(locale: Locale = 'zh'): BlogPost[] {
  let posts = loadContentDir(localeDirs[locale], 'blog', parsePost, caches[locale])
  if (locale !== 'zh') {
    // An untranslated post still exists — list the Chinese version rather
    // than leaving a hole in the notebook.
    const bySlug = new Map(posts.map(p => [p.slug, p]))
    posts = getAllPosts('zh').map(p => bySlug.get(p.slug) ?? p)
  }
  // newest first
  posts.sort((a, b) => b.date.localeCompare(a.date))
  return posts
}

export function getPost(slug: string, locale: Locale = 'zh'): BlogPost | undefined {
  return getAllPosts(locale).find(p => p.slug === slug)
}
