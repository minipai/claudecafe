import type { CastMember, Shift } from '@/agent'
import type { Expression } from './types'

/** A saved maid may have been removed from the configured character folder. */
export function availableShift(cast: CastMember[], shift: Shift): Shift {
  return { maid: cast.find((maid) => maid.id === shift.maid)?.id ?? cast[0].id }
}

/** Missing expressions use the same maid's neutral portrait. */
export function spriteFor(maid: CastMember, expression: Expression) {
  return maid.expressions[expression] ?? maid.expressions.neutral
}

/** Missing artwork is represented by a kaomoji beside her name. */
export function hasArtwork(maid: CastMember, expression: Expression) {
  return Boolean(maid.expressions[expression])
}
