import type { Locale } from '../i18n.js'
import cast from '../cast.json'

// The cast lives in the `@claudecafe/characters` workspace package: one folder
// per maid, named after her, holding her persona file in each language beside
// her artwork. scripts/build-cast.ts reads the persona files into cast.json at
// build time — the Worker has no filesystem to read them from.

export interface Maid {
  slug: string
  jaName: string
  enName: string
  title: string
  quote: string
  rawMd: string
  /** The whole file, frontmatter included — what /<slug>.md serves, so a
   * downloaded persona keeps her name: for the cafe plugin to display. */
  sourceMd: string
}

export function getAllMaids(locale: Locale = 'zh'): Maid[] {
  const maids: Maid[] = cast[locale]
  if (locale === 'zh') return maids
  // A maid whose translation hasn't landed yet still exists — show her
  // Chinese card rather than dropping her from the café.
  const translated = new Map(maids.map(m => [m.slug, m]))
  return getAllMaids('zh').map(m => translated.get(m.slug) ?? m)
}

export function getMaid(name: string, locale: Locale = 'zh'): Maid | undefined {
  return getAllMaids(locale).find(m => m.slug === name || m.enName.toLowerCase() === name.toLowerCase())
}
