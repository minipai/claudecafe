import cafe from '../assets/backdrops/scenes/cafe.webp'
import spring from '../assets/backdrops/scenes/spring.webp'
import summer from '../assets/backdrops/scenes/summer.webp'
import autumn from '../assets/backdrops/scenes/autumn.webp'
import winter from '../assets/backdrops/scenes/winter.webp'
import mucha from '../assets/backdrops/scenes/mucha.webp'
import edgeBrush from '../assets/backdrops/edges/brush.png'
import edgeStrokes from '../assets/backdrops/edges/strokes.png'
import edgeGrid from '../assets/backdrops/edges/grid.png'

/**
 * The rooms she can be standing in — plain rectangles nearly all of them,
 * because what stands behind her and how it stops are two separate questions
 * here.
 *
 * Asking for a picture that fades out on its own is a fight with whoever draws
 * it: every attempt comes back as a small badge floating on a big white page.
 * Asking for an ordinary rectangle is no fight at all, so the shape is decided
 * afterwards, below, where it is a number rather than a wish.
 *
 * `none` leaves the desktop showing, which is where the window started and
 * where it goes back to.
 */
export const SCENES: readonly Scene[] = [
  { id: 'none', src: '' },
  { id: 'cafe', src: cafe },
  { id: 'spring', src: spring },
  { id: 'summer', src: summer },
  { id: 'autumn', src: autumn },
  { id: 'winter', src: winter },
  // Not a room but a cut-out ornament, so it is not stretched over the window:
  // it is drawn at the width it was drawn for — her own frame's width, which is
  // the size it was being shown at all along — with the desktop showing either
  // side of it.
  { id: 'mucha', src: mucha, pinned: 512 },
]

/** One thing that can stand behind her. `pinned` is a width in pixels, for the
 * ones that are objects rather than rooms. */
type Scene = { id: string; src: string; pinned?: number }

/**
 * How the picture ends. `brush`, `strokes` and `grid` are masks — a picture
 * where the ink keeps and the clear parts let the desktop through, multiplied
 * into the scene's own transparency. `cinema` adds instead, and its hard bars are the
 * point of it. `blur` takes nothing away at all: it throws the whole room out
 * of focus, so she is the only thing on screen that is sharp.
 */
export const EDGES = [
  { id: 'none', mask: '' },
  { id: 'blur', mask: '' },
  { id: 'brush', mask: edgeBrush },
  { id: 'strokes', mask: edgeStrokes },
  { id: 'grid', mask: edgeGrid },
  { id: 'cinema', mask: '' },
] as const

export function sceneSrc(scene: string) {
  return SCENES.find((one) => one.id === scene)?.src ?? ''
}

/**
 * The scene cut to shape and filled into a box, as a URL to hand an `<img>`.
 *
 * The box is the window: the backdrop is what the window is made of, so it is
 * measured against the window rather than against her. Everything is painted at
 * that size — the scene cropped to fill it, the edge stretched to match — which
 * is why the picker can show the same thing in miniature and be telling the
 * truth.
 *
 * Done with a canvas rather than a CSS mask because a CSS mask the browser
 * declines to apply fails by showing the whole rectangle, and a rectangle is
 * exactly what must never appear on a transparent window.
 */
export async function paintBackdrop(scene: string, edge: string, box: Box): Promise<string | null> {
  const src = sceneSrc(scene)
  if (!src) return null
  const picture = await load(src)
  if (edge === 'cinema') return url(cinema(picture, box))

  const filled = draw(box.width, box.height)
  if (edge === 'blur') {
    // No wider than the dialogue box below it: out of focus and full width, it
    // was the whole window gone soft rather than something standing behind her.
    const width = Math.min(BLUR_WIDTH, box.width)
    const left = (box.width - width) / 2
    const reach = Math.round(box.width * 0.007)
    filled.save()
    filled.beginPath()
    filled.rect(left, 0, width, box.height)
    filled.clip()
    // Painted past its own sides and cut back, because a blur reaches for what
    // is outside the picture as well, and outside it there is nothing — which
    // showed as the four edges quietly fading away.
    filled.filter = `blur(${reach}px)`
    cover(filled, picture, left - reach * 3, -reach * 3, width + reach * 6, box.height + reach * 6, 0.46)
    filled.filter = 'none'
    filled.restore()
    // Soft everywhere and then stopping at a ruled line reads as a mistake, so
    // the four sides are taken down as well — just enough that there is no
    // line, not so much that it becomes a shape.
    feather(filled, { x: left, y: 0, width, height: box.height }, Math.round(width * 0.26))
    return url(filled)
  }
  const pinned = SCENES.find((one) => one.id === scene)?.pinned
  if (pinned) {
    // Its own size, hung from the top edge. Pinned means pinned: it was drawn
    // to stand behind her, so it is the same size in a narrow window as in a
    // wide one, and only a window narrower than the drawing brings it down.
    // What runs off the bottom is the part that was always behind her skirt.
    const width = Math.min(pinned, box.width)
    filled.drawImage(picture, (box.width - width) / 2, PINNED_TOP, width, (picture.height * width) / picture.width)
  } else {
    cover(filled, picture, 0, 0, box.width, box.height, 0.46)
  }
  const mask = EDGES.find((one) => one.id === edge)?.mask
  if (!mask) return url(filled)
  // Keep the scene only where the mask has ink; everywhere else its alpha wins.
  filled.globalCompositeOperation = 'destination-in'
  filled.drawImage(await load(mask), 0, 0, box.width, box.height)
  return url(filled)
}

/** How far down an ornament hangs — where her head starts, so the drawing sits
 * around her rather than over her. */
const PINNED_TOP = 44

/** How wide the out-of-focus backdrop is allowed to be — the dialogue box's own
 * width, so the soft patch sits over her rather than over the whole desktop. */
const BLUR_WIDTH = 760

/** How much room the backdrop has been given, in device-independent pixels. */
export type Box = { width: number; height: number }

/**
 * A widescreen frame with solid bars over and under it, so she is standing
 * inside a shot rather than in front of a picture.
 *
 * Only ever a thumbnail of one: on the window itself the shot stops short of
 * the dialogue box rather than running to the foot of the window, which is a
 * shape laid out against the window rather than baked in (see Backdrop).
 */
function cinema(picture: Picture, box: Box) {
  const bar = Math.round(box.width * 0.095)
  const ctx = draw(box.width, box.height)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, box.width, box.height)
  cover(ctx, picture, 0, bar, box.width, box.height - bar * 2, 0.42)
  return ctx
}

/** Take the four sides down to nothing over `fade` pixels. Done as four passes
 * rather than one: the corners are eaten by two of them, which is what a corner
 * should look like. */
function feather(ctx: CanvasRenderingContext2D, at: Box & { x: number; y: number }, fade: number) {
  const { x, y, width, height } = at
  const sides: [number, number, number, number, [number, number, number, number]][] = [
    [x, y, width, fade, [0, y, 0, y + fade]],
    [x, y + height - fade, width, fade, [0, y + height, 0, y + height - fade]],
    [x, y, fade, height, [x, 0, x + fade, 0]],
    [x + width - fade, y, fade, height, [x + width, 0, x + width - fade, 0]],
  ]
  ctx.globalCompositeOperation = 'destination-out'
  for (const [left, top, w, h, [gx0, gy0, gx1, gy1]] of sides) {
    const gradient = ctx.createLinearGradient(gx0, gy0, gx1, gy1)
    gradient.addColorStop(0, 'rgba(0,0,0,1)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(left, top, w, h)
  }
  ctx.globalCompositeOperation = 'source-over'
}

/** Fill the box with the picture without squashing it, keeping the part of it
 * around `focus` — 0 the top of the picture, 1 the bottom. */
function cover(
  ctx: CanvasRenderingContext2D,
  picture: Picture,
  x: number,
  y: number,
  w: number,
  h: number,
  focus: number,
) {
  const scale = Math.max(w / picture.width, h / picture.height)
  const sw = w / scale
  const sh = h / scale
  const sy = Math.min(Math.max(picture.height * focus - sh / 2, 0), picture.height - sh)
  ctx.drawImage(picture, (picture.width - sw) / 2, sy, sw, sh, x, y, w, h)
}

/** Either kind of thing a canvas will draw from. */
type Picture = HTMLImageElement | HTMLCanvasElement

function draw(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas.getContext('2d')!
}

function url(ctx: CanvasRenderingContext2D) {
  return ctx.canvas.toDataURL('image/png')
}

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const picture = new Image()
    picture.onload = () => resolve(picture)
    picture.onerror = () => reject(new Error(`backdrop artwork missing: ${src}`))
    picture.src = src
  })
}
