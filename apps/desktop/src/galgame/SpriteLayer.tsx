import type { Expression } from './types'
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

const SPRITE: Record<Expression, string> = {
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

/**
 * Where she stands, and she stays there: one framing, hung off the bottom edge,
 * with the dialogue box over her lower body. Nothing that opens on top of the
 * scene moves her — the panels are on top of it, not instead of it.
 */
export function SpriteLayer({ expression }: { expression: Expression }) {
  return (
    // The window ends where it ends, and with nothing painted behind her that
    // edge used to cut her off mid-skirt. This fades her out just above it, so
    // she runs off the bottom of the scene instead of being sliced by it.
    <div className="pointer-events-none fixed inset-0 z-[2] [mask-image:linear-gradient(to_bottom,#000_calc(100%-130px),transparent_100%)]">
      <div className="pointer-events-none absolute -bottom-[460px] left-1/2 w-[min(100vw,512px)] -translate-x-1/2 max-sm:-bottom-[100px]">
        {/* She catches the pointer again — the window is transparent, and a maid
            you can click straight through is a ghost. Only where she is drawn:
            the alpha under the pointer decides (see useClickThrough), which is
            also what makes her a handle you can only grab by the sleeve. */}
        <img
          src={SPRITE[expression]}
          alt="ことね"
          draggable={false}
          data-art
          onPointerDown={(event) => {
            if (event.button !== 0) return
            window.cafe?.startDrag()
          }}
          className="pointer-events-auto h-auto w-full cursor-grab select-none active:cursor-grabbing"
        />
      </div>
    </div>
  )
}
