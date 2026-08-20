import { describe, expect, it } from 'vitest'
import type { Expression } from '@/agent/expressions'
import { hasArtwork } from './SpriteLayer'

describe('hasArtwork', () => {
  it('knows the faces she has been drawn wearing', () => {
    expect(hasArtwork('neutral')).toBe(true)
    expect(hasArtwork('horny')).toBe(true)
  })

  // The artwork is drawn one at a time, so the table runs ahead of it — and a
  // character of her own brings however many faces she has.
  it('is false for a face in the table that nobody has drawn yet', () => {
    expect(hasArtwork('pouty' as Expression)).toBe(false)
  })
})
