import { describe, expect, it } from 'vitest'
import { EXPRESSIONS } from '@/agent/expressions'
import { hasArtwork, spriteFor } from './SpriteLayer'

describe('hasArtwork', () => {
  it('has artwork for every face in the mood table', () => {
    for (const expression of EXPRESSIONS) expect(hasArtwork(expression)).toBe(true)
  })

  it('lets runtime sources override bundled artwork', () => {
    const uploaded = 'blob:https://cafe.test/kotone-happy'

    expect(spriteFor('happy', { happy: uploaded })).toBe(uploaded)
    expect(hasArtwork('happy', { happy: uploaded })).toBe(true)
  })
})
