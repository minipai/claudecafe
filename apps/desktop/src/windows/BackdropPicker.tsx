import { text } from '@/i18n'
import type { Backdrop } from '@/agent'
import { BACKDROPS, backdropSrc } from '@/galgame/backdrops'

export function BackdropPicker({
  chosen,
  onChoose,
}: {
  chosen: Backdrop
  onChoose: (chosen: Backdrop) => void
}) {
  const t = text()

  return (
    <div className="flex flex-wrap gap-2">
      {BACKDROPS.map((backdrop) => {
        const src = backdropSrc(backdrop)
        const label = t.backdrop[backdrop]
        return (
          <form key={backdrop} onSubmit={(event) => { event.preventDefault(); onChoose(backdrop) }}>
            <button
              type="submit"
              aria-label={label}
              aria-pressed={backdrop === chosen}
              className={`group flex w-[84px] flex-col gap-1 rounded-lg border p-1 text-left transition-colors ${
                backdrop === chosen ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
              }`}
            >
              <span className="flex h-[70px] w-full items-center justify-center overflow-hidden rounded-md bg-muted/40">
                {src ? <img src={src} alt="" className="size-full object-contain" /> : <span aria-hidden>∅</span>}
              </span>
              <span className="truncate text-[11px] leading-tight text-muted-foreground group-hover:text-foreground">
                {label}
              </span>
            </button>
          </form>
        )
      })}
    </div>
  )
}
