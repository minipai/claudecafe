import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { castList, type CastMember, type Shift } from '@/agent'
import { text } from '@/i18n'
import { MAIDS, bustFor, outfitsOf, wearable } from './cast'

/**
 * Handing the shift to somebody else, and picking what she wears.
 *
 * It opens when a conversation is being started over, because that is the only
 * moment it can: who she is goes into the session's system prompt, and a maid
 * halfway through a conversation cannot be told she is somebody else. Making
 * that the moment is also what keeps it out of the way — nobody changes maid
 * mid-thought, and a switcher sitting on the window would invite exactly that.
 *
 * Everyone here is shown standing rather than named in a list. Which of them
 * the master wants is a question about a face, and a row of names answers a
 * different one.
 */
export function ShiftPanel({
  open,
  chosen,
  onStart,
  onCancel,
}: {
  open: boolean
  chosen: Shift
  onStart: (shift: Shift, name: string) => void
  onCancel: () => void
}) {
  const t = text().shift
  const cast = useCast(open)
  const [picked, setPicked] = useState(chosen)
  // The panel is mounted for the life of the window, so what was picked last
  // time is still sitting in it: whoever is on shift now is the answer it
  // should open on, every time.
  useEffect(() => {
    if (open) setPicked(wearable(chosen))
  }, [open, chosen.maid, chosen.outfit])

  const wardrobe = outfitsOf(picked.maid)

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(560px,92vw)] max-w-none gap-0 border border-border bg-card/90 p-0 shadow-xl backdrop-blur-xl sm:max-w-[560px]"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onStart(picked, nameOf(cast, picked.maid))
          }}
        >
          <div className="border-b border-border px-6 py-5">
            <DialogTitle className="text-lg font-semibold text-foreground">{t.title}</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-muted-foreground">{t.body}</DialogDescription>
          </div>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className="flex flex-wrap gap-3">
              {MAIDS.map((maid) => (
                <Standing
                  key={maid}
                  name={nameOf(cast, maid)}
                  // Each of them stands in what she would be put in: the outfit
                  // already picked if this is who is picked, her café clothes
                  // otherwise. Showing everyone in the same one would make the
                  // wardrobe below look like it belonged to nobody.
                  shift={maid === picked.maid ? picked : { maid, outfit: outfitsOf(maid)[0] }}
                  picked={maid === picked.maid}
                  onPick={() => setPicked({ maid, outfit: outfitsOf(maid)[0] })}
                />
              ))}
            </div>

            {/* Only when there is a choice in it. A maid with one outfit has a
                wardrobe; a row with one thing in it reads as a broken row. */}
            {wardrobe.length > 1 && (
              <section>
                <h2 className="mb-2 text-xs font-medium text-muted-foreground">{t.wearing}</h2>
                <div className="flex flex-wrap gap-2">
                  {wardrobe.map((outfit) => (
                    <Button
                      key={outfit}
                      type="button"
                      size="sm"
                      variant={outfit === picked.outfit ? 'default' : 'outline'}
                      onClick={() => setPicked({ ...picked, outfit })}
                    >
                      {labelOf(cast, picked.maid, outfit)}
                    </Button>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              {t.keep}
            </Button>
            <Button type="submit" size="sm">
              {t.start}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** One of them, from the waist up.
 *
 * Her half-body portrait rather than her sprite: cropping the full-length one
 * down to a card left her an inch tall and ragged with it, and cropping the two
 * maids to the same rectangle left one of them filling her card while the other
 * sat small in the middle of hers — they are not drawn to one head size. The
 * portrait is cut to a settled head size instead, so a row of them is a row of
 * faces the same size (see crop-bust.py).
 */
function Standing({
  name,
  shift,
  picked,
  onPick,
}: {
  name: string
  shift: Shift
  picked: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      // They share the row rather than taking a fixed width, so two of them are
      // two big cards and a cast that grows is still one tidy row.
      className={`flex min-w-[132px] flex-1 flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-colors ${
        picked ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
      }`}
    >
      <span className="block aspect-[4/5] w-full overflow-hidden rounded-md bg-muted/40">
        <img
          src={bustFor(shift)}
          alt=""
          aria-hidden
          draggable={false}
          className="size-full object-contain select-none"
        />
      </span>
      <span className="truncate text-sm font-medium text-foreground">{name}</span>
    </button>
  )
}

/** Everyone with a persona, as their own files name them. Asked when the panel
 * first opens rather than when the window does: it is a read off disk in the
 * main process, and a panel nobody opens should not cost one. */
function useCast(open: boolean) {
  const [cast, setCast] = useState<CastMember[]>([])

  useEffect(() => {
    if (!open || cast.length) return
    void castList()
      .catch(() => [])
      .then(setCast)
  }, [open, cast.length])

  return cast
}

/** What to call her. Her id until her persona file has been read — which is a
 * moment, and is still better than a card with nothing on it. */
function nameOf(cast: CastMember[], maid: string) {
  return cast.find((one) => one.id === maid)?.name ?? maid
}

/** What to call an outfit. The folder's name stands when nobody has worded it:
 * for a wardrobe somebody else drew, that is the only name there is. */
function labelOf(cast: CastMember[], maid: string, outfit: string) {
  return cast.find((one) => one.id === maid)?.outfits.find((one) => one.id === outfit)?.label ?? outfit
}
