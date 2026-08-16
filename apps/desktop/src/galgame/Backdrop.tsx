import muchaBackdrop from '../assets/mucha-backdrop.webp'

/**
 * A free-edged Art Nouveau print behind her. The artwork is translucent and
 * irregular, so it masks the busy desktop without turning the transparent
 * window back into a rectangular card.
 *
 * It hangs inside her own frame rather than off the window: measured against
 * her, the disc sits behind her head at every window size. Pinned to the top
 * edge instead — which it was — a tall window pulled the two apart and left her
 * standing under a halo floating somewhere above her.
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
      // Her frame is 512 wide by 1280 tall; the print is a little wider than
      // her and starts a few percent down it, which is what puts the disc
      // behind her head and her shoulders over the flowers.
      //
      // Its own base dissolves before it ends: the print is taller than the
      // room under the dialogue box, and a window edge cutting through the
      // flowers left a pale arc sitting on the desktop below her.
      className="pointer-events-auto absolute top-[6.5%] left-1/2 z-[1] h-auto w-[113%] -translate-x-1/2 cursor-grab select-none [mask-image:linear-gradient(to_bottom,#000_72%,transparent_93%)] active:cursor-grabbing"
    />
  )
}
