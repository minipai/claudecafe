import muchaBackdrop from '../assets/mucha-backdrop.png'

/**
 * A free-edged Art Nouveau print behind her. The artwork is translucent and
 * irregular, so it masks the busy desktop without turning the transparent
 * window back into a rectangular card.
 *
 * It is `data-art` like she is: the pointer falls through the window where the
 * print is not painted, and stops on the flowers where it is — which also makes
 * the print a handle the window can be dragged by.
 */
export function Backdrop() {
  return (
    <img
      src={muchaBackdrop}
      alt=""
      aria-hidden
      draggable={false}
      data-art
      onPointerDown={(event) => {
        if (event.button !== 0) return
        window.cafe?.startDrag()
      }}
      // Dropped below the top edge so her head clears the disc rather than
      // being ringed by it.
      className="pointer-events-auto absolute top-16 left-1/2 z-[1] h-auto w-[min(580px,90vw)] -translate-x-1/2 cursor-grab select-none active:cursor-grabbing"
    />
  )
}
