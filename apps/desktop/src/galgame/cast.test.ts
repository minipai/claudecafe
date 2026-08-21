import { describe, expect, it } from 'vitest'
import { EXPRESSIONS } from '@/agent/expressions'
import { MAIDS, hasArtwork, outfitsOf, spriteFor, wearable } from './cast'

describe('the wardrobe', () => {
  it('carries both maids the window offers', () => {
    expect(MAIDS).toEqual(['kotone', 'kurumi'])
  })

  it('has every face in the mood table, in every outfit', () => {
    for (const maid of MAIDS)
      for (const outfit of outfitsOf(maid))
        for (const expression of EXPRESSIONS) expect(hasArtwork({ maid, outfit }, expression)).toBe(true)
  })

  it('hangs her café clothes first, whatever else she has', () => {
    expect(outfitsOf('kotone')[0]).toBe('uniform')
    expect(outfitsOf('kotone')).toContain('one-piece')
  })
})

describe('wearable', () => {
  it('leaves a shift it can draw alone', () => {
    expect(wearable({ maid: 'kurumi', outfit: 'uniform' })).toEqual({ maid: 'kurumi', outfit: 'uniform' })
  })

  it('falls back to the first maid when the kept one is no longer drawn', () => {
    expect(wearable({ maid: 'kanae', outfit: 'uniform' })).toEqual({ maid: 'kotone', outfit: 'uniform' })
  })

  it('falls back to her café clothes when the kept outfit is gone', () => {
    expect(wearable({ maid: 'kurumi', outfit: 'one-piece' })).toEqual({ maid: 'kurumi', outfit: 'uniform' })
  })

  it('still stands someone up rather than nobody', () => {
    const sprite = spriteFor({ maid: 'nobody', outfit: 'nothing' }, 'happy')
    expect(sprite).toBe(spriteFor({ maid: 'kotone', outfit: 'uniform' }, 'happy'))
  })
})

describe('spriteFor', () => {
  it('dresses each maid in her own artwork', () => {
    expect(spriteFor({ maid: 'kotone', outfit: 'uniform' }, 'happy')).not.toBe(
      spriteFor({ maid: 'kurumi', outfit: 'uniform' }, 'happy'),
    )
  })

  it('changes what she wears without changing who she is', () => {
    expect(spriteFor({ maid: 'kotone', outfit: 'uniform' }, 'happy')).not.toBe(
      spriteFor({ maid: 'kotone', outfit: 'one-piece' }, 'happy'),
    )
  })
})
