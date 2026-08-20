import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import matter from 'gray-matter'
import type { Locale } from '../i18n.js'

// The cast lives in the `@claudecafe/characters` workspace package: one folder
// per maid, named after her, holding her persona file in each language beside
// her artwork. Resolve the package from its manifest path so the lookup works
// both in dev (pnpm symlink) and in the Docker bundle (the deploy carries only
// the persona files into node_modules — the artwork stays out of the image).
const require = createRequire(import.meta.url)
const castDir = dirname(require.resolve('@claudecafe/characters/package.json'))

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

const isDev = process.env.NODE_ENV !== 'production'
const caches: Record<Locale, Maid[] | null> = { zh: null, en: null }

function parseMaid(slug: string, raw: string): Maid {
  // The empty options turn gray-matter's cache off. Cached, frontmatter that
  // fails to parse throws once and then quietly reads as empty for the rest of
  // the process — the maid comes back nameless instead of the fault repeating.
  const { data, content } = matter(raw, {})
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

/**
 * Every character with a persona file in this language. The package also holds
 * the shared drawing spec and the scripts that normalize the artwork — folders
 * with nobody in them, which is why the persona file is what decides who counts
 * rather than the folder simply being there.
 *
 * Only a persona that isn't there is shrugged off. Anything else the read
 * throws — frontmatter that no longer parses, an unreadable cast — is a fault
 * that has to be heard: caught here it would drop a maid out of the café
 * quietly, with every page still answering 200.
 */
function readCast(locale: Locale): Maid[] {
  const folders = readdirSync(castDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()

  return folders.flatMap((slug) => {
    const file = join(castDir, slug, `persona.${locale}.md`)
    return existsSync(file) ? [parseMaid(slug, readFileSync(file, 'utf-8'))] : []
  })
}

export function getAllMaids(locale: Locale = 'zh'): Maid[] {
  let maids = caches[locale]
  if (!maids || isDev) {
    maids = readCast(locale)
    caches[locale] = maids
  }
  if (locale === 'zh') return maids
  // A maid whose translation hasn't landed yet still exists — show her
  // Chinese card rather than dropping her from the café.
  const translated = new Map(maids.map(m => [m.slug, m]))
  return getAllMaids('zh').map(m => translated.get(m.slug) ?? m)
}

export function getMaid(name: string, locale: Locale = 'zh'): Maid | undefined {
  return getAllMaids(locale).find(m => m.slug === name || m.enName.toLowerCase() === name.toLowerCase())
}
