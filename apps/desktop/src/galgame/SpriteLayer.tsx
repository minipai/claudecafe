import type { Expression } from './types'
import { Backdrop } from './Backdrop'
import neutral from '../assets/kotone-neutral.webp'
import happy from '../assets/kotone-happy.webp'
import curious from '../assets/kotone-curious.webp'
import thinking from '../assets/kotone-thinking.webp'
import focused from '../assets/kotone-focused.webp'
import proud from '../assets/kotone-proud.webp'
import embarrassed from '../assets/kotone-embarrassed.webp'
import frustrated from '../assets/kotone-frustrated.webp'
import confused from '../assets/kotone-confused.webp'
import surprised from '../assets/kotone-surprised.webp'
import sad from '../assets/kotone-sad.webp'
import flirty from '../assets/kotone-flirty.webp'
import horny from '../assets/kotone-horny.webp'

/**
 * The faces she has been drawn wearing. Not every expression in the table is
 * in here: the artwork is drawn one at a time, and a character of her own
 * brings however many she has — so a face with no picture behind it is normal
 * rather than a mistake.
 */
const SPRITE: Partial<Record<Expression, string>> = {
  neutral,
  happy,
  curious,
  thinking,
  focused,
  proud,
  embarrassed,
  frustrated,
  confused,
  surprised,
  sad,
  flirty,
  horny,
}

/** Whether she has actually been drawn wearing this face. A face with no
 * artwork leaves her standing neutral, and the kaomoji stands in for it beside
 * her name (see GalgameClient). */
export function hasArtwork(expression: Expression) {
  return expression in SPRITE
}

/**
 * Where she stands, and she stays there: one framing, hung off the bottom edge,
 * with the dialogue box over her lower body. Nothing that opens on top of the
 * scene moves her — the panels are on top of it, not instead of it.
 */
export function SpriteLayer({ expression }: { expression: Expression }) {
  return (
    // The window ends where it ends, and with nothing painted behind her that
    // edge used to cut her off mid-skirt. This fades her out above it, so she
    // runs off the bottom of the scene instead of being sliced by it — and the
    // fade finishes clear of the edge, because the last of it lingering there
    // reads as a smudge under the dialogue box rather than as her.
    <div className="pointer-events-none fixed inset-0 z-[2] [mask-image:linear-gradient(to_bottom,#000_calc(100%-190px),transparent_calc(100%-42px))]">
      <div className="pointer-events-none absolute -bottom-[460px] left-1/2 w-[min(100vw,512px)] -translate-x-1/2 max-sm:-bottom-[100px]">
        {/* The print hangs off her frame, not off the window, so the two are
            never pulled apart by a window taller than the one they were laid
            out in. */}
        <Backdrop />
        {/* She catches the pointer again — the window is transparent, and a maid
            you can click straight through is a ghost. Only where she is drawn:
            the alpha under the pointer decides (see useClickThrough), which is
            also what makes her a handle you can only grab by the sleeve. */}
        <img
          src={SPRITE[expression] ?? neutral}
          alt="ことね"
          draggable={false}
          data-art
          onPointerDown={(event) => {
            if (event.button !== 0) return
            window.cafe?.startDrag()
          }}
          className="pointer-events-auto relative z-[2] h-auto w-full cursor-grab select-none active:cursor-grabbing"
        />
      </div>
    </div>
  )
}
