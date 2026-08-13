import { useEffect, useState } from 'react'
import { workingDirectory, type SessionStatus } from '@/agent'
import { WORKING_DIRECTORY } from './content'

/**
 * Session status floating at the bottom edge. Everything here is measured: the
 * folder the window is bound to, its git state, the context the last turn
 * carried, and how long the session has been open. A segment that has nothing
 * to report is simply not drawn.
 *
 * It rides on a plate because what is behind it is her — dark hair, black
 * dress — and a glow around the letters is no match for that. A plate, not a
 * pill: the scene has enough round things in it already, and it slides under
 * the dialogue box, which is the thing being looked at.
 */
export function StatusBar() {
  const status = useLiveStatus()
  const elapsed = useElapsed()
  const folder = workingDirectory ?? WORKING_DIRECTORY
  const changed = status && (status.added > 0 || status.removed > 0)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2.5 z-[5] flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-b-lg bg-card/90 px-4 py-1.5 font-mono text-sm font-medium text-foreground/90 shadow-[0_1px_10px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <span title={folder}>{folder.split('/').pop()}</span>
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
        <span className="text-foreground/30">·</span>
        <span>{elapsed}</span>
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

/** How long this window has been open — the one number the window itself owns. */
function useElapsed() {
  const [minutes, setMinutes] = useState(0)

  useEffect(() => {
    const opened = Date.now()
    const timer = window.setInterval(() => setMinutes(Math.floor((Date.now() - opened) / 60000)), 10000)
    return () => window.clearInterval(timer)
  }, [])

  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function compact(tokens: number) {
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens)
}
