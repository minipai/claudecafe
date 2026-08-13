import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type CommandPanelProps = {
  open: boolean
  /** The command that opened it, shown the way it was typed. */
  title: string
  description: string
  /** False while the session is still being asked. */
  ready: boolean
  /** Said instead of the body when the session answered with nothing. */
  missing?: string
  onClose: () => void
  children: ReactNode
}

/**
 * The frame a slash command's answer opens in — the backlog's modal, so
 * everything that comes up over the scene comes up the same way. Nothing is
 * painted over the window behind it: the panel floats, and she goes on standing
 * where she was.
 */
export function CommandPanel({
  open,
  title,
  description,
  ready,
  missing,
  onClose,
  children,
}: CommandPanelProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(620px,76vh)] w-[min(560px,88vw)] max-w-none flex-col gap-0 overflow-hidden border border-border bg-card/80 p-0 shadow-xl backdrop-blur-xl sm:max-w-[560px]"
      >
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-4 py-2.5 text-left">
          <DialogTitle className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Close ${title}`}>
              <X />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {ready ? (
            missing ? (
              <div className="flex h-full items-center justify-center">
                <p className="max-w-[320px] text-center text-sm text-muted-foreground">{missing}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-7">{children}</div>
            )
          ) : (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Ask the session as the panel opens, and again every time it is reopened —
 * these are all live figures, and a panel showing what was true ten minutes ago
 * is worse than one that takes a moment.
 */
export function useAnswer<T>(open: boolean, ask: () => Promise<T | null | undefined>) {
  const [answer, setAnswer] = useState<T | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open) return
    let listening = true
    setReady(false)
    void ask().then((value) => {
      if (!listening) return
      setAnswer(value ?? null)
      setReady(true)
    })
    return () => {
      listening = false
    }
    // Only the opening asks; `ask` is written inline and would otherwise ask again
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return { answer, ready }
}

export function Heading({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-xs font-medium text-muted-foreground">{children}</h2>
}

/** A bar for a share of something with a ceiling — a plan window, the context
 * window. It turns when the ceiling is close enough to matter. */
export function Meter({
  label,
  percent,
  note,
  caption,
}: {
  label: string
  percent: number
  /** Sits beside the label, on the right — the figure the bar is drawn from. */
  note: string
  /** Under the bar, when there is something more to say about it. */
  caption?: string
}) {
  const filled = Math.max(0, Math.min(100, percent))
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-foreground">{label}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{note}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${filled >= 90 ? 'bg-destructive' : 'bg-primary'}`}
          // A share too small to draw still gets a mark, or the row reads as zero.
          style={{ width: `${filled > 0 ? Math.max(filled, 0.6) : 0}%` }}
        />
      </div>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </div>
  )
}

/** A plain figure: what it is on the left, what it measures on the right. */
export function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="truncate text-foreground">{label}</span>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{value}</span>
    </div>
  )
}

/** Tokens the way the terminal counts them: 27.4k, 1m, 380. */
export function tokens(count: number) {
  if (count >= 1_000_000) return `${round(count / 1_000_000)}m`
  if (count >= 1_000) return `${round(count / 1_000)}k`
  return String(count)
}

function round(value: number) {
  return value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
}
