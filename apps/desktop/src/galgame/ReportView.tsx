import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { marked } from 'marked'
import { Button } from '@/components/ui/button'
import { text } from '@/i18n'

type ReportViewProps = {
  shortline: string
  report: string
  onClose: () => void
  /** Shown in a bar under the body — used when the panel is a plan waiting on an answer. */
  actions?: ReactNode
}

/**
 * The same dialogue box, grown into a full report panel. Shares layoutId
 * "dialogue-frame" with DialogueBox so Motion morphs between them.
 */
export function ReportView({ shortline, report, onClose, actions }: ReportViewProps) {
  const [contentVisible, setContentVisible] = useState(false)
  const [shortlineFaded, setShortlineFaded] = useState(false)

  // Esc leaves the panel, the same as clicking off it. Everything else that
  // opens over the scene is a dialogue and closes on Esc already; this one is
  // drawn by hand so that it can morph out of the box she speaks in, and it was
  // the one thing on screen the key did nothing to.
  useEffect(() => {
    const leave = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', leave)
    return () => window.removeEventListener('keydown', leave)
  }, [onClose])

  return (
    <motion.div
      layout
      layoutId="dialogue-frame"
      transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
      onLayoutAnimationComplete={() => {
        setContentVisible(true)
        setShortlineFaded(true)
      }}
      className="fixed inset-0 z-[150] m-auto flex h-[min(700px,82vh)] w-[min(920px,84vw)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
    >
      <div
        className="absolute top-[18px] right-[22px] z-[6]"
        style={{ opacity: contentVisible ? 1 : 0, pointerEvents: contentVisible ? 'auto' : 'none' }}
      >
        <Button variant="ghost" size="icon-sm" aria-label={text().scene.close} onClick={onClose}>
          <X />
        </Button>
      </div>

      {!shortlineFaded && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-card px-[12%] text-center text-lg leading-[1.8] text-foreground"
          animate={{ opacity: shortlineFaded ? 0 : 1 }}
          transition={{ duration: 0.22 }}
        >
          {shortline}
        </motion.div>
      )}

      <div
        className="min-h-0 flex-1 overflow-y-auto px-12 pt-[46px] pb-5"
        style={{ opacity: contentVisible ? 1 : 0, transition: 'opacity .3s ease' }}
      >
        <div
          className="report-md mx-auto max-w-[620px]"
          // Line breaks are kept: a slash command prints plain text whose lines
          // are the layout, and markdown would otherwise run them together.
          dangerouslySetInnerHTML={{ __html: marked.parse(report, { async: false, breaks: true }) }}
        />
      </div>

      {actions && (
        <div
          className="flex items-center justify-end gap-2 border-t border-border px-6 py-3.5"
          style={{ opacity: contentVisible ? 1 : 0, transition: 'opacity .3s ease' }}
        >
          {actions}
        </div>
      )}
    </motion.div>
  )
}
