import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { fill, her, text } from '@/i18n'
import type { Trouble } from '@/agent'

/** The one thing to go and type when she is locked out. It is a command, not a
 * sentence, so it is the same in every language. */
const SIGN_IN = 'claude'

/**
 * Not a slash command's answer but the same frame: something went wrong that
 * she cannot work around, said in words instead of left as an error string
 * nobody reads. It sits over the scene until it is dismissed — she is still
 * standing there, and the master may well want to look at the log meanwhile.
 */
export function TroublePanel({ trouble, onClose }: { trouble: Trouble | null; onClose: () => void }) {
  const t = text().trouble
  const [detailShown, setDetailShown] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const said = trouble ? t[trouble.reason === 'sign-in' ? 'signIn' : trouble.reason] : null

  // Whatever the retry found — the door open, or shut for the same reason as
  // before — the answer has arrived, so the button is his again.
  useEffect(() => setRetrying(false), [trouble])

  return (
    <Dialog open={Boolean(trouble)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex w-[min(460px,88vw)] max-w-none flex-col gap-0 overflow-hidden border border-border bg-card/85 p-0 shadow-xl backdrop-blur-xl sm:max-w-[460px]"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <DialogTitle className="text-base font-semibold text-foreground">{said ? fill(said.title, { her: her() }) : null}</DialogTitle>
          <Button variant="ghost" size="icon-sm" aria-label={t.close} onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="px-6 pt-2 pb-5">
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {said?.body}
          </DialogDescription>

          {trouble?.reason === 'sign-in' && (
            <>
              {/* The one thing to go and type. Shown as a command because that
                  is what it is — the sign-in lives in the terminal, not here —
                  but the button saves him the trip, and the second one is what
                  he presses on the way back. */}
              <pre className="mt-4 rounded-md border border-border bg-muted/60 px-3 py-2 font-mono text-xs text-foreground/80">
                {SIGN_IN}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => window.cafe?.signIn()}>
                  {t.signIn.open}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={retrying}
                  onClick={() => {
                    setRetrying(true)
                    window.cafe?.reconnect()
                  }}
                >
                  {retrying ? t.signIn.checking : t.signIn.retry}
                </Button>
              </div>
            </>
          )}

          {trouble && (
            <details className="mt-4" open={detailShown} onToggle={(event) => setDetailShown(event.currentTarget.open)}>
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                {t.detail}
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-muted/60 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/70">
                {trouble.detail}
              </pre>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
