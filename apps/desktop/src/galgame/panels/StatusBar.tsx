import { useEffect, useState } from 'react'
import { openingStatus, type SessionStatus } from '@/agent'
import { openSideWindow } from '@/agent/windows'
import { text } from '@/i18n'

/** The current project and branch, with a direct route to project selection. */
export function StatusBar({ folder }: { folder: string }) {
  const status = useLiveStatus()
  if (!folder && !status?.branch) return null

  return (
    <form className="min-w-0 font-mono text-xs text-muted-foreground" onSubmit={(event) => {
      event.preventDefault()
      openSideWindow('projects')
    }}>
      <button
        type="submit"
        aria-label={text().bar.projects}
        title={folder}
        className="flex w-full min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 hover:text-primary"
      >
        {folder && <span className="min-w-0 truncate">{folder}</span>}
        {status?.branch && (
          <span className="max-w-[42%] shrink-0 truncate rounded-full border border-border px-2 text-[11px] text-primary">{status.branch}</span>
        )}
      </button>
    </form>
  )
}

function useLiveStatus() {
  const [status, setStatus] = useState<SessionStatus | null>(openingStatus)

  useEffect(() => {
    const stop = window.cafe?.listen((event) => {
      if (event.kind === 'status') setStatus(event.status)
    })
    return stop
  }, [])

  return status
}
