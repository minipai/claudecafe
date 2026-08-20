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
    expect(faceFor('【 開心 (˶ˆᗜˆ˵) 】')).toBe('happy')
    expect(faceFor('  (  ˶ ˆ ᗜ ˆ ˵ )  ')).toBe('happy')
  })

  it('returns null for a marker naming no face at all', () => {
    expect(faceFor('【 just words, no face 】')).toBeNull()
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
