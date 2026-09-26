import { useEffect } from 'react'

/**
 * Where nothing is drawn, nothing is clicked: the window hands the pointer to
 * whatever is behind it and takes it straight back when the pointer reaches
 * something drawn.
 *
 * What counts as nothing is what the pointer actually lands on. The whispers
 * take no pointer events, so they are never it; the empty scene around them is
 * marked `data-ghost` and is. The artwork is the awkward part — she and the
 * print behind her are rectangles that are mostly air, so the pixel under the
 * pointer decides, and a see-through pixel means looking further down the pile
 * rather than giving up: her skirt may be transparent exactly where the print
 * behind it is not.
 */
export function useClickThrough() {
  useEffect(() => {
    const bridge = window.cafe
    if (!bridge) return

    let through = false
    /** Something drawn is being carried: the window is moving under the
     * pointer, and if it were handed away mid-drag the letting-go would never
     * arrive. */
    let carrying = false

    // A fresh page — ⌘R, a crash recovered from — starts believing nothing is
    // being ignored, whatever the main process still thinks. Said again on
    // mount, the same as it is said on the way out, so the two are never out
    // of step with each other.
    bridge.clickThrough(false)

    const aim = (event: MouseEvent) => {
      if (carrying) return
      const empty = isEmptyAt(event.clientX, event.clientY)
      if (empty === through) return
      through = empty
      bridge.clickThrough(empty)
    }
    const grab = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.dataset.art !== undefined) carrying = true
    }
    const drop = () => {
      if (!carrying) return
      carrying = false
      bridge.endDrag()
    }

    /** Once the pointer is handed away no move of it reaches the window, so the
     * only way back is the cursor read off the screen. Anything drawn under it
     * takes her out of the wall she has become. */
    const reachable = (x: number, y: number) => {
      if (carrying || !through || isEmptyAt(x, y)) return
      through = false
      bridge.clickThrough(false)
    }

    window.addEventListener('mousemove', aim)
    window.addEventListener('pointerdown', grab)
    window.addEventListener('pointerup', drop)
    window.addEventListener('blur', drop)
    const stopFollowing = bridge.followPointer(reachable)
    return () => {
      stopFollowing()
      window.removeEventListener('mousemove', aim)
      window.removeEventListener('pointerdown', grab)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('blur', drop)
      bridge.clickThrough(false)
    }
  }, [])
}

/** Alpha below this is air. Low, because the print's outer flourishes fade out
 * and should still stop a click. */
const DRAWN = 24

function isEmptyAt(x: number, y: number) {
  // An open menu makes the rest of the page pointer-inert so that any click
  // outside it is its dismissal — which reads as air here. Every click while
  // it is open belongs to this window, none to whatever is behind it.
  if (document.body.style.pointerEvents === 'none') return false
  for (const under of document.elementsFromPoint(x, y)) {
    if (under === document.body || under === document.documentElement) break
    if (under instanceof HTMLImageElement && under.dataset.art !== undefined) {
      if (alphaAt(under, x, y) >= DRAWN) return false
      continue // see-through here — whatever is under it may not be
    }
    if (under.hasAttribute('data-ghost')) continue
    return false // a panel, a button, something with a surface
  }
  return true
}

/** The drawn width the mask is read at — enough to tell hair from air, small
 * enough that every expression and the print cost nothing to keep. */
const MASK_WIDTH = 192
const masks = new Map<string, ImageData>()

function alphaAt(art: HTMLImageElement, x: number, y: number) {
  const mask = maskFor(art)
  if (!mask) return 255 // not decoded yet — treat it as solid rather than gone
  const box = art.getBoundingClientRect()
  const across = (x - box.left) / box.width
  const down = (y - box.top) / box.height
  if (across < 0 || across >= 1 || down < 0 || down >= 1) return 0
  const column = Math.floor(across * mask.width)
  const row = Math.floor(down * mask.height)
  return mask.data[(row * mask.width + column) * 4 + 3]
}

function maskFor(art: HTMLImageElement) {
  const key = art.currentSrc || art.src
  const known = masks.get(key)
  if (known) return known
  if (!art.complete || !art.naturalWidth) return null

  const width = Math.min(MASK_WIDTH, art.naturalWidth)
  const height = Math.round((width / art.naturalWidth) * art.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const paper = canvas.getContext('2d', { willReadFrequently: true })
  if (!paper) return null
  paper.drawImage(art, 0, 0, width, height)
  const mask = paper.getImageData(0, 0, width, height)
  masks.set(key, mask)
  return mask
}
