import { useEffect, useState } from 'react'
import { type SessionStatus } from '@/agent'

/**
 * Session status floating at the bottom edge. Everything here is measured: the
 * folder the window is bound to, its git state, the context the last turn
 * carried, and how much of the five-hour allowance is left to run. A segment
 * that has nothing to report is simply not drawn.
 *
 * It rides on a plate because what is behind it is her — dark hair, black
 * dress — and a glow around the letters is no match for that. A plate, not a
 * pill: the scene has enough round things in it already, and it slides under
 * the dialogue box, which is the thing being looked at.
 */
/** `folder` is passed in rather than read once: she can be sent elsewhere while
 * the window stays put, and the status line may never lag behind where she is. */
export function StatusBar({ folder }: { folder: string }) {
  const status = useLiveStatus()
  const block = useBlockLeft()
  const changed = status && (status.added > 0 || status.removed > 0)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2.5 z-[5] flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-b-lg bg-card/90 px-4 py-1.5 font-mono text-sm font-medium text-foreground/90 shadow-[0_1px_10px_rgba(0,0,0,0.06)] backdrop-blur-md">
        {/* Nothing stands in for the folder when there is none — the window
         * always opens on one, so an empty name means the bridge is not there. */}
        {folder && <span title={folder}>{folder.split('/').pop()}</span>}
        {status?.branch && (
          <>
            <span className="text-foreground/30">·</span>
            <span>⎇ {status.branch}</span>
          </>
        )}
        {changed && <span>+{status.added} −{status.removed}</span>}
        {status?.contextTokens ? (
          <>
            <span className="text-foreground/30">·</span>
            <span>{compact(status.contextTokens)}</span>
          </>
        ) : null}
        {block && (
          <>
            <span className="text-foreground/30">·</span>
            {/* The plan's own word for the window, kept as the terminal prints
                it — the master reads the two side by side. */}
            <span>Block: {block}</span>
          </>
        )}
      </div>
    </div>
  )
}

function useLiveStatus() {
  const [status, setStatus] = useState<SessionStatus | null>(null)

  useEffect(() => {
    const stop = window.cafe?.listen((event) => {
      if (event.kind === 'status') setStatus(event.status)
    })
    window.cafe?.refresh()
    return stop
  }, [])

  return status
}

/**
 * What is left of the rolling five-hour allowance. The window it counts down to
 * is the plan's, not this window's, so a reload or a resumed conversation reads
 * the same as the terminal does — which is the point of it being here at all.
 */
function useBlockLeft() {
  const [resetsAt, setResetsAt] = useState<string | null>(null)
  const [left, setLeft] = useState<string | null>(null)

  useEffect(() => {
    // The rolling session window is the first one the plan reports.
    const read = () =>
      void window.cafe?.usage().then((report) => setResetsAt(report?.windows[0]?.resetsAt ?? null))
    read()
    // A five-hour window moves slowly; this is only here to pick up the next
    // one starting, since the countdown itself is done from the time it names.
    const timer = window.setInterval(read, 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!resetsAt) {
      setLeft(null)
      return
    }
    const tick = () => setLeft(untilReset(resetsAt))
    tick()
    const timer = window.setInterval(tick, 30_000)
    return () => window.clearInterval(timer)
  }, [resetsAt])

  return left
}

function untilReset(iso: string) {
  const minutes = Math.floor((new Date(iso).getTime() - Date.now()) / 60000)
  if (minutes <= 0) return null
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}hr ${minutes % 60}m`
}

function compact(tokens: number) {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens)
}
