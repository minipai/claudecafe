/**
 * Galgame-style speaker plate floating over the dialogue frame's top-left
 * corner. Her name and nothing else: the face she is wearing is on the artwork
 * behind it, and the mood she signed with is written out at the foot of the box
 * — a kaomoji here as well was the same thing said three times.
 *
 * Her name is the way to hand the next conversation to another maid.
 */
export function NamePlate({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <form className="relative z-10 shrink-0" onSubmit={(event) => { event.preventDefault(); onOpen() }}>
      <button
        type="submit"
        className="inline-flex h-[38px] cursor-pointer items-center rounded-full bg-primary px-4 py-1.5 shadow-md transition-shadow hover:shadow-lg"
      >
        <span className="text-[19.2px] font-normal tracking-[0.05em] text-primary-foreground">
          {name}
        </span>
      </button>
    </form>
  )
}
