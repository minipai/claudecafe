/**
 * Galgame-style speaker plate floating over the dialogue frame's top-left
 * corner. Her name and nothing else: the face she is wearing is on the artwork
 * behind it, and the mood she signed with is written out at the foot of the box
 * — a kaomoji here as well was the same thing said three times.
 */
export function NamePlate() {
  return (
    <div className="inline-flex items-center rounded-lg bg-primary px-4 py-1.5 shadow-md">
      <span className="text-sm font-semibold tracking-[0.2em] text-primary-foreground">
        ことね
      </span>
    </div>
  )
}
