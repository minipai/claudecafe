import { text } from '@/i18n'

/**
 * Galgame-style speaker plate floating over the dialogue frame's top-left
 * corner. Her name and nothing else: the face she is wearing is on the artwork
 * behind it, and the mood she signed with is written out at the foot of the box
 * — a kaomoji here as well was the same thing said three times.
 *
 * Her name is also the way in to who she is: press the plate and the persona
 * she is wearing opens.
 */
export function NamePlate({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={text().scene.openPersona}
      className="inline-flex cursor-pointer items-center rounded-lg bg-primary px-4 py-1.5 shadow-md transition-shadow hover:shadow-lg"
    >
      <span className="text-sm font-semibold tracking-[0.2em] text-primary-foreground">
        ことね
      </span>
    </button>
  )
}
