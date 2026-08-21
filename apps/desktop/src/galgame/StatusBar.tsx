import { useEffect, useState } from 'react'
import { MAIDS } from './cast'
import { openingStatus, usageReport, type SessionStatus } from '@/agent'

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
  const refill = useRefillTime()
  const changed = status && (status.added > 0 || status.removed > 0)

  // A plate with nothing on it is just a white tab hanging off the box.
  if (!folder && !status?.branch && !changed && !status?.contextTokens && !refill) return null

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
        {refill && (
          <>
            <span className="text-foreground/30">·</span>
            {/* The hour itself rather than what is left of it: a countdown has
                to be turned back into a clock time before it means anything,
                and it is the same hour the terminal prints. */}
            <span>Reset: {refill}</span>
          </>
        )}
      </div>
    </div>
  )
}

function useLiveStatus() {
  const [status, setStatus] = useState<SessionStatus | null>(openingStatus)

  useEffect(() => {
    const stop = window.cafe?.listen((event) => {
      if (event.kind === 'status') setStatus(event.status)
    })
    window.cafe?.refresh(MAIDS)
    return stop
  }, [])

  return status
}

/**
 * When the rolling five-hour allowance refills. The window it reads is the
 * plan's, not this window's, so a reload or a resumed conversation reads the
 * same as the terminal does — which is the point of it being here at all.
 */
function useRefillTime() {
  const [at, setAt] = useState<string | null>(null)

  useEffect(() => {
    // The rolling session window is the first one the plan reports.
    const read = () =>
      void usageReport().then((report) => setAt(clockTime(report?.windows[0]?.resetsAt)))
    read()
    // A five-hour window moves slowly, and the hour it names does not move at
    // all: this is only here to pick up the next window starting.
    const timer = window.setInterval(read, 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  return at
}

/** The hour it refills at, or nothing for a window that already has. */
function clockTime(iso: string | null | undefined) {
  if (!iso) return null
  const when = new Date(iso)
  if (when.getTime() <= Date.now()) return null
  return when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function compact(tokens: number) {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens)
}
