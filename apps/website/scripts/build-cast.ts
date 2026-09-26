// Reads the cast out of `@claudecafe/characters` into src/cast.json. The site
// runs as a Cloudflare Worker, which has no filesystem to read persona files
// from, so they are parsed here and bundled in. `wrangler dev` reruns this
// whenever a persona changes (see `build` in wrangler.jsonc).
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import matter from 'gray-matter'
import type { Maid } from '../src/utils/maids.js'
import { locales, type Locale } from '../src/i18n.js'

const require = createRequire(import.meta.url)
const castDir = dirname(require.resolve('@claudecafe/characters/package.json'))
const out = new URL('../src/cast.json', import.meta.url)

const cast = Object.fromEntries(locales.map(locale => [locale, readCast(locale)])) as Record<Locale, Maid[]>
writeFileSync(out, JSON.stringify(cast, null, 2) + '\n')

/**
 * Every character with a persona file in this language. The package also holds
 * the shared drawing spec and the scripts that normalize the artwork — folders
 * with nobody in them, which is why the persona file is what decides who counts
 * rather than the folder simply being there.
 *
 * Only a persona that isn't there is shrugged off. Anything else the read
 * throws — frontmatter that no longer parses, an unreadable cast — fails the
 * build: caught here it would drop a maid out of the café quietly.
 */
function readCast(locale: Locale): Maid[] {
  const folders = readdirSync(castDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()

  return folders.flatMap((slug) => {
    // English is the default persona.md; other locales are persona.<locale>.md variants.
    const file = join(castDir, slug, locale === 'en' ? 'persona.md' : `persona.${locale}.md`)
    return existsSync(file) ? [parseMaid(slug, readFileSync(file, 'utf-8'))] : []
  })
}

function parseMaid(slug: string, raw: string): Maid {
  const { data, content } = matter(raw)
  return {
    slug,
    jaName: (data.name as string) ?? slug,
    enName: ((data.id as string)?.split('/').at(-1) ?? slug).replace(/^./, letter => letter.toUpperCase()),
    title: (data.personality as string) ?? '',
    quote: (data.quote as string) ?? '',
    rawMd: content,
    sourceMd: raw,
  }
}
