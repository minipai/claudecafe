import type { Backdrop as Chosen } from '@/agent'
import { EXPRESSIONS } from '@/agent/expressions'
import type { Expression } from './types'
import { Backdrop, WidescreenBackdrop } from './Backdrop'

export type SpriteSources = Partial<Record<Expression, string>>

const spriteModules = import.meta.glob('../assets/kotone-*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

/**
 * The faces she has been drawn wearing. The partial record is intentional: if
 * the mood table grows ahead of the artwork again, an undrawn face can still
 * fall back to neutral instead of breaking the scene.
 */
const SPRITE = Object.fromEntries(
  EXPRESSIONS.flatMap((expression) => {
    const source = spriteModules[`../assets/kotone-${expression}.webp`]
    return source ? [[expression, source]] : []
  }),
) as SpriteSources

const neutral = SPRITE.neutral
if (!neutral) throw new Error('Missing bundled neutral sprite')

/** Resolve through a runtime map first so uploaded sprites can be blob: URLs,
 * custom-protocol URLs, or persisted file URLs without becoming build imports. */
export function spriteFor(expression: Expression, custom: SpriteSources = {}) {
  return custom[expression] ?? SPRITE[expression] ?? neutral
}

/** Whether she has actually been drawn wearing this face. A face with no
 * artwork leaves her standing neutral, and the kaomoji stands in for it beside
 * her name (see GalgameClient). */
export function hasArtwork(expression: Expression, custom: SpriteSources = {}) {
  return Boolean(custom[expression] ?? SPRITE[expression])
}

/**
 * Where she stands, and she stays there: one framing, hung off the bottom edge,
 * with the dialogue box over her lower body. Nothing that opens on top of the
 * scene moves her — the panels are on top of it, not instead of it.
 */
export function SpriteLayer({
  expression,
  backdrop,
  sprites,
}: {
  expression: Expression
  backdrop: Chosen
  sprites?: SpriteSources
}) {
  return (
    <>
      {/* The widescreen frame is the one backdrop laid out against the window
          rather than against her, so it sits outside everything below. */}
      {backdrop.edge === 'cinema' && <WidescreenBackdrop scene={backdrop.scene} />}
      {/* Behind everything and as big as the window: the backdrop is what the
          window is made of, so it is hung off the window rather than off her.
          Outside the fade below, too — that fade is about her hem, and running
          it over the backdrop dissolved the foot of the room as well. */}
      <Backdrop scene={backdrop.scene} edge={backdrop.edge} />
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
        <div className="pointer-events-none absolute -bottom-[460px] left-1/2 z-[2] w-[min(100vw,512px)] -translate-x-1/2 max-sm:-bottom-[100px]">
          {/* She catches the pointer again — the window is transparent, and a maid
            you can click straight through is a ghost. Only where she is drawn:
            the alpha under the pointer decides (see useClickThrough), which is
            also what makes her a handle you can only grab by the sleeve. */}
          <img
            src={spriteFor(expression, sprites)}
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
    </>
  )
}
