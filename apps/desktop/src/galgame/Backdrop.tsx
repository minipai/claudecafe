import type { Backdrop as Chosen } from '@/agent'
import { backdropSrc } from './backdrops'

export function Backdrop({ chosen }: { chosen: Chosen }) {
  const src = backdropSrc(chosen)
  if (!src) return null

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      data-art
      onPointerDown={(event) => {
        if (event.button === 0) window.cafe?.startDrag()
      }}
      className="pointer-events-auto fixed top-[35px] left-1/2 z-[1] w-[min(560px,88vw)] max-w-none -translate-x-1/2 cursor-grab select-none active:cursor-grabbing"
    />
  )
}
