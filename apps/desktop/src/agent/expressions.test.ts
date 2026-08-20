import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { faceFor, KAOMOJI } from './expressions'

describe('faceFor', () => {
  it('matches every kaomoji in the table to its own expression', () => {
    for (const [expression, kaomoji] of Object.entries(KAOMOJI)) {
      expect(faceFor(kaomoji)).toBe(expression)
    }
  })

  it('matches a marker with the plain-language name and extra spacing around the kaomoji', () => {
    expect(faceFor('【 開心 \\(ˆ ᗜ ˆ)/ 】')).toBe('happy')
    expect(faceFor('  \\ ( ˆ ᗜ ˆ ) /  ')).toBe('happy')
  })

  it('returns null for a marker naming no face at all', () => {
    expect(faceFor('【 just words, no face 】')).toBeNull()
  })

  // The spacing inside these is what evens out how wide they are, and it is
  // adjusted freely for that. Every one of them has to survive being written
  // with the spacing somewhere else — or in a transcript from before it moved.
  it('matches every kaomoji however its spacing falls', () => {
    for (const [expression, kaomoji] of Object.entries(KAOMOJI)) {
      expect(faceFor(kaomoji.replace(/\s+/g, ''))).toBe(expression)
      expect(faceFor(kaomoji.split('').join(' '))).toBe(expression)
    }
  })

  // The lookup takes the first kaomoji the marker contains, so one that sits
  // inside another can never be picked — the face it names would be dead on
  // arrival. Worth failing here rather than in a marker nobody can explain.
  it('has no kaomoji hiding inside another', () => {
    const bare = (text: string) => text.replace(/\s+/g, '')
    const swallowed = Object.entries(KAOMOJI).flatMap(([expression, kaomoji]) =>
      Object.entries(KAOMOJI)
        .filter(([other, inside]) => other !== expression && bare(kaomoji).includes(bare(inside)))
        .map(([other]) => `${other} inside ${expression}`),
    )
    expect(swallowed).toEqual([])
  })
})

/**
 * The table she writes her markers from lives in the café plugin, which ships
 * on its own and knows nothing about this window. Copied by hand into two
 * repositories of text, the two drift — and a marker written off a kaomoji
 * this side has never heard of picks no face at all, so she goes on wearing
 * whatever she had on. Silent, and only visible as a face that stopped
 * keeping up.
 */
describe('the plugin\'s copy of the table', () => {
  const cues = readFileSync(
    fileURLToPath(new URL('../../../../packages/cafe/prompts/cues.md', import.meta.url)),
    'utf8',
  )

  it('names the same faces with the same kaomoji, in the same order', () => {
    // Every row, whatever is written in it — a name matched too narrowly would
    // skip the very row that drifted and pass on the thirteen that did not.
    const rows = [...cues.matchAll(/^\|([^|\n]+)\|([^|\n]+)\|$/gm)]
      .map(([, expression, kaomoji]) => [expression.trim(), kaomoji.trim()])
      .filter(([expression]) => expression !== 'expression' && !/^-+$/.test(expression))
    expect(Object.fromEntries(rows)).toEqual(KAOMOJI)
    expect(rows.map(([expression]) => expression)).toEqual(Object.keys(KAOMOJI))
  })
})
