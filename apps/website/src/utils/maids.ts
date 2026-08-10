import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { loadContentDir } from './content.js'
import type { Locale } from '../i18n.js'

// Persona definitions live in the `@claudecafe/maid-personas` workspace package. Resolve
// its directory from the manifest path so the lookup works both in dev (pnpm
// symlink) and in the Docker bundle (pnpm deploy copies it into node_modules).
// One directory per language, named after it.
const require = createRequire(import.meta.url)
const personasDir = dirname(require.resolve('@claudecafe/maid-personas/package.json'))
const localeDirs: Record<Locale, string> = {
  zh: join(personasDir, 'zh'),
  en: join(personasDir, 'en'),
}

export interface Maid {
  slug: string
  jaName: string
  enName: string
  title: string
  quote: string
  rawMd: string
  /** The whole file, frontmatter included — what /<slug>.md serves, so a
   * downloaded persona keeps her name: for the cafe plugin's status line. */
  sourceMd: string
}

const caches: Record<Locale, { items: Maid[] | null }> = {
  zh: { items: null },
  en: { items: null },
}

function parseMaid(slug: string, data: Record<string, unknown>, content: string, raw: string): Maid {
  return {
    slug,
    jaName: (data.name as string) ?? slug,
    enName: (data.id as string) ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    title: (data.personality as string) ?? '',
    quote: (data.quote as string) ?? '',
    rawMd: content,
    sourceMd: raw,
  }
}

export function getAllMaids(locale: Locale = 'zh'): Maid[] {
  const maids = loadContentDir(localeDirs[locale], 'maids', parseMaid, caches[locale])
  if (locale === 'zh') return maids
  // A maid whose translation hasn't landed yet still exists — show her
  // Chinese card rather than dropping her from the café.
  const bySlug = new Map(maids.map(m => [m.slug, m]))
  return getAllMaids('zh').map(m => bySlug.get(m.slug) ?? m)
}

export function getMaid(name: string, locale: Locale = 'zh'): Maid | undefined {
  return getAllMaids(locale).find(m => m.slug === name || m.enName.toLowerCase() === name.toLowerCase())
}
