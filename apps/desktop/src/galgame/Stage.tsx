import type { ReactNode } from 'react'
import { useClickThrough } from './useClickThrough'

export function Stage({ children }: { children: ReactNode }) {
  useClickThrough()

  return (
    // Nothing of its own is drawn here, so the pointer falls through it to
    // whatever the master has open behind the window.
    <div data-ghost className="fixed inset-0 overflow-hidden">
      {children}
    </div>
  )
}
