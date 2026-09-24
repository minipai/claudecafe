import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { CastMember, Shift } from '@/agent'
import { text } from '@/i18n'
import { availableShift } from './cast'

/** A new conversation is the moment to hand the shift to somebody else. */
export function ShiftPanel({
  open,
  chosen,
  cast,
  directory,
  onStart,
  onCancel,
}: {
  open: boolean
  chosen: Shift
  cast: CastMember[]
  directory: string
  onStart: (shift: Shift, name: string) => void
  onCancel: () => void
}) {
  const t = text().shift
  const [picked, setPicked] = useState(chosen)
  useEffect(() => {
    if (open) setPicked(availableShift(cast, chosen))
  }, [open, chosen.maid, cast])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(560px,92vw)] max-w-none gap-0 border border-border bg-card/90 p-0 shadow-xl backdrop-blur-xl sm:max-w-[560px]"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onStart(picked, cast.find((maid) => maid.id === picked.maid)!.name)
          }}
        >
          <div className="border-b border-border px-6 py-5">
            <DialogTitle className="text-lg font-semibold text-foreground">{t.title}</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-muted-foreground">{t.body}</DialogDescription>
          </div>
          <div className="flex max-h-[50vh] flex-wrap gap-3 overflow-y-auto px-6 py-5">
            {cast.map((maid) => (
              <label
                key={maid.id}
                className={`flex min-w-[132px] flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${
                  maid.id === picked.maid ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
                }`}
              >
                <input className="sr-only" type="radio" name="maid" value={maid.id} checked={maid.id === picked.maid} onChange={() => setPicked({ maid: maid.id })} />
                <span className="block aspect-square w-full overflow-hidden rounded-md bg-muted/40">
                  <img src={maid.avatar} alt="" aria-hidden draggable={false} className="size-full object-contain select-none" />
                </span>
                <span className="truncate text-sm font-medium text-foreground">{maid.name}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{t.keep}</Button>
            <Button type="submit" size="sm">{t.start}</Button>
          </div>
        </form>
        <p className="break-all border-t border-border px-6 py-3 text-xs text-muted-foreground">{directory}</p>
      </DialogContent>
    </Dialog>
  )
}
