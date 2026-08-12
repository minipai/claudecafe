import type { ReactNode } from 'react'

export function Stage({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden bg-background">{children}</div>
}
