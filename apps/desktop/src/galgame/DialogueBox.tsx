import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { marked } from 'marked'
import { Button } from '@/components/ui/button'
import { NamePlate } from './NamePlate'
import { InnerVoice } from './InnerVoice'
import type { Look } from '@/agent'
import type { Pace } from './useSpeech'
import type { Expression } from './types'

/** Auto-play reads at his pace; skip runs to the end of what she has said. */
const PACES: Pace[] = ['auto', 'skip']

type DialogueBoxProps = {
  expression: Expression
  line: string
  isTyping: boolean
  /** An answer with shape to it — markdown, laid out in place of the typed line. */
  laidOut: string | null
  isLoading: boolean
  /** She has more lines behind this one, waiting for the master to click on. */
  hasMore: boolean
  onAdvance: () => void
  /** Who is turning the pages — him, or the scene itself. */
  pace: Pace
  onPace: (pace: Pace) => void
  /** The words she wrote on the link to her report; absent while there is none. */
  cta: string | null
  onOpenReport: () => void
  footer: ReactNode
  utility: ReactNode
  unreadLook: Look | null
  onLookRead: () => void
}

/**
 * The galgame dialogue panel — one frame holding the spoken line on top and
 * the demo/input footer below a divider. Short-tier replies just type into
 * it in place, and it grows/shrinks in place for the medium tier. It shares
 * a layoutId with ReportView so Motion morphs it into the big report panel
 * for the heavy tier instead of it being a separate transition.
 */
export function DialogueBox({
  expression,
  line,
  isTyping,
  laidOut,
  isLoading,
  hasMore,
  onAdvance,
  pace,
  onPace,
  cta,
  onOpenReport,
  footer,
  utility,
  unreadLook,
  onLookRead,
}: DialogueBoxProps) {
  return (
    <motion.div
      layout
      layoutId="dialogue-frame"
      transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
      className="relative w-full rounded-xl border border-border bg-card shadow-md"
    >
      <div className="absolute -top-4 left-6 z-10 flex items-center gap-2.5">
        <NamePlate expression={expression} isLoading={isLoading} />
        {unreadLook && <InnerVoice look={unreadLook} onRead={onLookRead} />}
      </div>
      <div className="absolute -top-4 right-4 z-10">{utility}</div>

      {/* The bottom padding leaves room for the corner controls, so they sit in
          the margin rather than against what she just said. */}
      <motion.div layout className="relative overflow-hidden px-6.5 pt-7 pb-9">
          {laidOut ? (
            <div
              className="report-md text-base leading-[1.9] text-foreground"
              dangerouslySetInnerHTML={{ __html: marked.parse(laidOut, { async: false }) }}
            />
          ) : (
            <div className="min-h-[2.2em] text-lg leading-[1.8] text-foreground">
              {line}
              {isTyping && (
                <span className="ml-0.5 inline-block h-[1em] w-0.5 -translate-y-0.5 animate-[caret-blink_1s_step-end_infinite] bg-foreground align-middle" />
              )}
            </div>
          )}

          {/* Who turns the page, in the corner she turns it from: AUTO and SKIP
              hand the turning over, and the triangle is the master doing it
              himself — the only thing to press, since her line is dialogue and
              not a button. */}
          <div className="absolute right-6 bottom-3 flex items-center gap-1.5">
            {PACES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={pace === option}
                title={option === 'auto' ? 'Turn pages automatically' : 'Run to the end of what she has said'}
                onClick={() => onPace(pace === option ? 'manual' : option)}
                className={`rounded px-1.5 py-1 font-mono text-[10px] leading-none tracking-[0.14em] uppercase transition-colors ${
                  pace === option
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground/50 hover:text-foreground'
                }`}
              >
                {option}
              </button>
            ))}
            {/* The triangle comes and goes; its place does not, or the two
                beside it would shuffle every time she finishes a line. */}
            <span className="flex h-5 w-5 items-center justify-center">
              {hasMore && !isTyping && (
                <button type="button" aria-label="Next line" onClick={onAdvance} className="p-1">
                  <span className="block h-0 w-0 animate-[tri-blink_1.1s_ease-in-out_infinite] border-t-[8px] border-r-[6px] border-l-[6px] border-t-foreground border-r-transparent border-l-transparent" />
                </button>
              )}
            </span>
          </div>

        {cta && (
          <div className="mt-3 flex gap-2.5">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onOpenReport()
              }}
            >
              {cta}
            </Button>
          </div>
        )}
      </motion.div>

      <motion.div layout className="flex flex-col gap-2 border-t border-border px-4 pt-3 pb-3">
        {footer}
      </motion.div>
    </motion.div>
  )
}
