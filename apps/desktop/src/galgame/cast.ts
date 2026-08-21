import { EXPRESSIONS } from '@/agent/expressions'
import type { Shift } from '@/agent'
import type { Expression } from './types'

/**
 * Everyone the window can put on shift, and everything each of them has to
 * wear.
 *
 * The artwork is the cast: a maid the app carries no sprites for cannot stand
 * in the window at all, so the folders decide who is on the list rather than a
 * table written out beside them. They mirror the characters package — a folder
 * per maid, a folder per outfit inside her — and scripts/pack-sprites.sh is
 * what puts them here.
 *
 * What she is *called* is not in here. That comes off her persona file, which
 * the main process reads, because a maid the master hired himself was never in
 * the window's own catalogue (see castOf in electron/lines.ts).
 */
const drawn = import.meta.glob('../assets/cast/*/*/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

/** One outfit: the faces she has been drawn wearing it. Partial on purpose —
 * an outfit that is a face or two short still hangs in the wardrobe, and the
 * missing face falls back to her neutral in that same outfit. */
type Outfit = Partial<Record<Expression, string>>

const FACES = new Set<string>(EXPRESSIONS)

/** What the derived half-body portrait is filed under, beside the moods. */
const BUST = 'bust'

const CAST: Record<string, Record<string, Outfit>> = {}
/** Her half-body portrait per outfit, for showing her small. Cut from that
 * outfit's neutral at a settled head size, so two maids drawn to different
 * scales still come out the same size on a card (see crop-bust.py). */
const BUSTS: Record<string, Record<string, string>> = {}
for (const [file, url] of Object.entries(drawn)) {
  const [maid, outfit, sprite] = file.split('/').slice(-3)
  const face = sprite.replace(/\.webp$/, '')
  if (face === BUST) {
    BUSTS[maid] ??= {}
    BUSTS[maid][outfit] = url
    continue
  }
  // Anything else under there that is not one of the moods is not a face of
  // hers — a stray export — and would otherwise sit in the wardrobe as a face
  // nothing can ever ask for.
  if (!FACES.has(face)) continue
  CAST[maid] ??= {}
  CAST[maid][outfit] ??= {}
  CAST[maid][outfit][face as Expression] = url
}

/** The maids the window has artwork for, in a settled order. */
export const MAIDS = Object.keys(CAST).sort()

if (MAIDS.length === 0) throw new Error('No maid artwork bundled — run scripts/pack-sprites.sh')

/**
 * What she has to wear, her café clothes first. The rest fall in alphabetically
 * — arbitrary, but the same every launch, which is what a list being picked
 * from needs more than it needs an order with a meaning.
 */
export function outfitsOf(maid: string) {
  const wardrobe = Object.keys(CAST[maid] ?? {}).sort()
  return wardrobe.includes(UNIFORM) ? [UNIFORM, ...wardrobe.filter((one) => one !== UNIFORM)] : wardrobe
}

/** The café clothes, which every maid has and which she is normally in. */
const UNIFORM = 'uniform'

/**
 * The shift as the window can actually draw it. A choice kept from a version
 * that carried other artwork — a maid since dropped, an outfit renamed — would
 * otherwise leave the window with nobody in it, which reads as the app being
 * broken rather than as artwork having moved.
 */
export function wearable(shift: Shift): Shift {
  const maid = CAST[shift.maid] ? shift.maid : MAIDS[0]
  const wardrobe = outfitsOf(maid)
  return { maid, outfit: wardrobe.includes(shift.outfit) ? shift.outfit : wardrobe[0] }
}

/** Her face in what she is wearing. Falls back within the outfit she is in:
 * borrowing the missing face from another outfit would change her clothes
 * halfway through a sentence. */
export function spriteFor(shift: Shift, expression: Expression) {
  const worn = wearable(shift)
  const outfit = CAST[worn.maid][worn.outfit]
  const face = outfit[expression] ?? outfit.neutral
  if (!face) throw new Error(`${worn.maid}/${worn.outfit} has no neutral to fall back to`)
  return face
}

/** Her from the waist up in what she is wearing, for the places that show her
 * small — a full-length sprite an inch tall is a smudge. */
export function bustFor(shift: Shift) {
  const worn = wearable(shift)
  return BUSTS[worn.maid]?.[worn.outfit] ?? spriteFor(worn, 'neutral')
}

/** Whether she has actually been drawn wearing this face. One she has not
 * leaves her standing neutral, and the kaomoji stands in for it beside her name
 * (see GalgameClient). */
export function hasArtwork(shift: Shift, expression: Expression) {
  const worn = wearable(shift)
  return Boolean(CAST[worn.maid][worn.outfit][expression])
}
