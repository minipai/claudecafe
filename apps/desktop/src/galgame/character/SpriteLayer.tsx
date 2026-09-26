import type { Backdrop as Chosen, CastMember } from '@/agent'
import type { Expression } from '../types'
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
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <filter id="maid-paper" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            {/* Expand a smoothed alpha contour rather than a square dilation
                kernel, which makes hair and ribbon corners look jagged. */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 40 -0.5" result="outline" />
            <feFlood floodColor="white" />
            <feComposite in2="outline" operator="in" result="paper" />
            <feMerge>
              <feMergeNode in="paper" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#281c29" floodOpacity="0.38" />
          </filter>
        </defs>
      </svg>
      <Backdrop chosen={backdrop} />
      <div className="pointer-events-none fixed inset-0 z-[2]">
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
            style={{ filter: 'url(#maid-paper)' }}
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
