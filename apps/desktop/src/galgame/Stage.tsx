import type { ReactNode } from 'react'

export function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* The window has no title bar of its own, so the scene has to offer a
       * strip to drag it by. Controls inside it opt back out (see index.css). */}
      <div className="titlebar fixed inset-x-0 top-0 z-[8] h-9" />
      {children}
    </div>
  )
}
