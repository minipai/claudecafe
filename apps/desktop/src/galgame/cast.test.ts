import { describe, expect, it } from 'vitest'
import type { CastMember } from '@/agent'
import { availableShift, hasArtwork, spriteFor } from './cast'

const maid: CastMember = {
  id: 'custom-maid',
  name: 'Custom maid',
  avatar: 'cafe-character://cast/custom-maid/avatar.webp',
  expressions: {
    neutral: 'cafe-character://cast/custom-maid/portraits/neutral.webp',
    happy: 'cafe-character://cast/custom-maid/portraits/happy.webp',
  },
}

describe('runtime cast', () => {
  it('accepts a maid that was never bundled with the app', () => {
    expect(availableShift([maid], { maid: maid.id })).toEqual({ maid: maid.id })
    expect(spriteFor(maid, 'happy')).toBe(maid.expressions.happy)
  })

  it('replaces a removed maid with an available character', () => {
    expect(availableShift([maid], { maid: 'removed' })).toEqual({ maid: maid.id })
  })

  it('uses neutral for an expression the maid does not have', () => {
    expect(hasArtwork(maid, 'sad')).toBe(false)
    expect(spriteFor(maid, 'sad')).toBe(maid.expressions.neutral)
    expect(hasArtwork(maid, 'happy')).toBe(true)
  })
})
