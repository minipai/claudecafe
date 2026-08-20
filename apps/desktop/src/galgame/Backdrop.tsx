import { useEffect, useState } from 'react'
import { paintBackdrop, sceneSrc, type Box } from './backdrops'

/**
 * The widescreen frame: the room as wide as the window, from its top edge down
 * to where the dialogue box begins, with solid bars over and under it.
 *
 * This one is measured against the window rather than against her, because a
 * film frame that only spanned her shoulders would not be a film frame — the
 * whole effect is the shot reaching both edges of the screen. It also hangs
 * outside the fade the rest of the scene runs off the bottom into: a bar that
 * dissolves at one end is a bar that failed to be one.
 */
export function WidescreenBackdrop({ scene }: { scene: string }) {
  const src = sceneSrc(scene)
  if (!src) return null

  return (
    <div
      data-art
      onPointerDown={(event) => {
        if (event.button !== 0) return
        window.cafe?.startDrag()
      }}
      // Stopping short of the dialogue box rather than measuring it: the box
      // grows and shrinks with what she is saying, and a frame that resized
      // itself every time she spoke would be the most distracting thing on the
      // desktop. It stops clear of her name plate, which sits proud of the box.
      //
      // Deep bars and a long thin shot: the further off cinemascope it goes the
      // more it reads as a frame of film rather than as a picture with black
      // above and below it.
      className="pointer-events-auto fixed inset-x-0 top-0 bottom-[286px] z-[1] cursor-grab bg-black py-[9.5%] select-none active:cursor-grabbing"
    >
      <img src={src} alt="" aria-hidden draggable={false} className="size-full object-cover" />
    </div>
  )
}

/**
 * What is behind her — a room, cut to shape so it masks the busy desktop
 * without turning the transparent window back into a rectangular card.
 *
 * It is measured against the window, not against her: the backdrop is what the
 * window is made of, so it fills the whole of it and the scene is cropped to
 * suit rather than shrunk to fit. That is also why it is painted at the size it
 * will be shown at — a soft edge stretched from some other shape stops looking
 * like the edge it was drawn as.
 *
 * It is `data-art` like she is: the pointer falls through the window where the
 * artwork is not painted, and stops where it is — which also makes it a handle
 * the window can be dragged by.
 */
export function Backdrop({ scene, edge }: { scene: string; edge: string }) {
  // As wide as the window and as tall as the room needs to be: full height read
  // as the window having been papered over rather than as something standing
  // behind her.
  const width = useWindowWidth()
  // The widescreen frame is drawn by the component above, which stops short of
  // the dialogue box — painting it here as well put two shots on screen at once,
  // and painting it here *anyway* left a megabyte of picture nobody would see.
  const painted = usePainted(scene, edge, { width, height: BACKDROP_HEIGHT }, edge !== 'cinema')
  if (!painted) return null

  return (
    <img
      src={painted}
      alt=""
      aria-hidden
      draggable={false}
      data-art
      onPointerDown={(event) => {
        if (event.button !== 0) return
        window.cafe?.startDrag()
      }}
      // Its own bottom corners are rounded to match the top two, which are not
      // ours at all — macOS rounds the window itself, and a square foot under
      // two rounded shoulders reads as a mistake.
      className="pointer-events-auto fixed inset-x-0 top-0 z-[1] h-[560px] w-full max-w-none rounded-b-[10px] cursor-grab select-none active:cursor-grabbing"
    />
  )
}

/** The scene with its edge cut in, at the size it is about to be shown at.
 * Painting takes a moment and can be dropped halfway through — the choice can
 * change again before the first one lands — so a stale answer is thrown away
 * rather than shown. */
function usePainted(scene: string, edge: string, box: Box, wanted: boolean) {
  const [painted, setPainted] = useState<string | null>(null)

  useEffect(() => {
    if (!wanted) {
      setPainted(null)
      return
    }
    let current = true
    // A backdrop that will not load leaves her standing on the desktop, which
    // is a look the window already has rather than a failure to report.
    void paintBackdrop(scene, edge, box)
      .catch(() => null)
      .then((url) => {
        if (current) setPainted(url)
      })
    return () => {
      current = false
    }
  }, [scene, edge, box.width, box.height, wanted])

  return painted
}

/** How far down the window the backdrop reaches. */
const BACKDROP_HEIGHT = 560

/**
 * How wide the window is, in whole steps rather than to the pixel. Dragging a
 * corner would otherwise repaint the whole backdrop for every pixel crossed;
 * rounding means it is repainted a handful of times on the way instead, and the
 * stretch in between is never enough to see. Only the width is asked for — how
 * far down the backdrop reaches is fixed.
 */
function useWindowWidth() {
  const [width, setWidth] = useState(measure)

  useEffect(() => {
    const check = () => setWidth(measure)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return width
}

function measure() {
  const step = 32
  return Math.ceil(window.innerWidth / step) * step
}
