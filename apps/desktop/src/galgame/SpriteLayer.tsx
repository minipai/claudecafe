import type { Backdrop as Chosen, CastMember } from '@/agent'
import type { Expression } from './types'
import { spriteFor } from './cast'
import { Backdrop } from './Backdrop'

/**
 * Where she stands, and she stays there: one framing, hung from the top edge,
 * with the dialogue box over her lower body. Nothing that opens on top of the
 * scene moves her — the panels are on top of it, not instead of it.
 */
export function SpriteLayer({
  expression,
  maid,
  name,
  backdrop,
}: {
  expression: Expression
  maid: CastMember
  /** Whoever is standing there, so a screen reader is told who rather than
   * being told "maid". */
  name: string
  backdrop: Chosen
}) {
  return (
    <>
      <Backdrop chosen={backdrop} />
      {/* The window ends where it ends, and with nothing painted behind her
          that edge used to cut her off mid-skirt. This fades her out above it,
          so she runs off the bottom of the scene instead of being sliced by it
          — and the fade finishes clear of the edge, because the last of it
          lingering there reads as a smudge under the dialogue box rather than
          as her. */}
      <div className="pointer-events-none fixed inset-0 z-[2] [mask-image:linear-gradient(to_bottom,#000_calc(100%-190px),transparent_calc(100%-42px))]">
        {/* `z-[2]` to stand in front of the backdrop. Shifting this box half
            its own width to centre it makes it a layer of its own, so what is
            set on her inside it counts for nothing out here — without this the
            backdrop simply covered her. */}
        <div className="pointer-events-none absolute top-0 left-1/2 z-[2] flex w-[min(100vw,512px)] -translate-x-1/2 justify-center">
          {/* She catches the pointer again — the window is transparent, and a maid
            you can click straight through is a ghost. Only where she is drawn:
            the alpha under the pointer decides (see useClickThrough), which is
            also what makes her a handle you can only grab by the sleeve. */}
          <img
            src={spriteFor(maid, expression)}
            crossOrigin="anonymous"
            alt={name}
            draggable={false}
            data-art
            onPointerDown={(event) => {
              if (event.button !== 0) return
              window.cafe?.startDrag()
            }}
            className="pointer-events-auto relative z-[2] h-auto max-h-screen w-auto max-w-full cursor-grab select-none active:cursor-grabbing"
          />
        </div>
      </div>
    </>
  )
}
