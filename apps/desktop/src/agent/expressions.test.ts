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
