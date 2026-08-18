import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { marked } from 'marked'
import { Button } from '@/components/ui/button'
import { NamePlate } from './NamePlate'
import { WaitingLine } from './WaitingLine'
import { InnerVoice } from './InnerVoice'
import type { Look } from '@/agent'
import type { Pace } from './useSpeech'
import { fill, text } from '@/i18n'

type DialogueBoxProps = {
  line: string
  isTyping: boolean
  /** Whether the line in the box was said before the question just asked. */
  isPast: boolean
  /** An answer with shape to it — markdown, laid out in place of the typed line. */
  laidOut: string | null
  isLoading: boolean
  /** The 【…】 she signed the line in the box with, as she wrote it. */
  mood: string | null
  /** Her own words for the wait, cycled through while she works. */
  waiting: string[]
  /** How much she has written this turn, as the session counts it. */
  outputTokens: number
  /** How many lines are behind this one, waiting for the master to click on. */
  queued: number
  onAdvance: () => void
  /** Who is turning the pages — him, or the scene itself. */
  pace: Pace
  onPace: (pace: Pace) => void
  /** The words she wrote on the link to her report; absent while there is none. */
  cta: string | null
  onOpenReport: () => void
  /** Pressing her name plate — it opens the persona she is wearing. */
  onOpenPersona: () => void
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
  line,
  isTyping,
  isPast,
  laidOut,
  isLoading,
  mood,
  waiting,
  outputTokens,
  queued,
  onAdvance,
  pace,
  onPace,
  cta,
  onOpenReport,
  onOpenPersona,
  footer,
  utility,
  unreadLook,
  onLookRead,
}: DialogueBoxProps) {
  const t = text().scene
  const said = useRef<HTMLDivElement>(null)

  // A laid-out answer arrives whole, so it is put in front of the master at its
  // beginning rather than wherever the last one was left.
  useEffect(() => {
    if (said.current) said.current.scrollTop = 0
  }, [laidOut])

  // A spoken line is written out a few letters at a time, and what is being
  // watched is the end of it — so a long one follows the caret down. A laid-out
  // answer is typed out too, off screen, and must not be dragged along with it.
  useEffect(() => {
    if (isTyping && !laidOut && said.current) said.current.scrollTop = said.current.scrollHeight
  }, [line, isTyping, laidOut])

  return (
    <motion.div
      layout
      layoutId="dialogue-frame"
      transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
      className="relative w-full rounded-xl border border-border bg-card shadow-md"
    >
      <div className="absolute -top-4 left-6 z-10 flex items-center gap-2.5">
        <NamePlate onOpen={onOpenPersona} />
        {unreadLook && <InnerVoice look={unreadLook} onRead={onLookRead} />}
      </div>
      <div className="absolute -top-4 right-4 z-10">{utility}</div>

      {/* The bottom padding leaves room for the corner controls, so they sit in
          the margin rather than against what she just said. */}
      <motion.div layout className="relative overflow-hidden px-6.5 pt-7 pb-9">
          {/* She is standing behind this, and the box grows from the bottom
              edge up. Left to grow, an answer she wrote out in full instead of
              handing over covers her to the top of the window — so it stops
              short of her shoulders and what does not fit scrolls. The cap is
              in pixels because she is hung off the bottom edge too: how far up
              her shoulders are does not change with the window's height, and
              the fraction is only there for a window too short for the whole
              of it. */}
          <div ref={said} className="max-h-[min(300px,34vh)] overflow-y-auto overscroll-contain">
          {laidOut ? (
            <div
              className="report-md text-base leading-[1.9] text-foreground"
              // Single line breaks are kept, the same as the report panel and
              // the log: she writes a line per point as often as she leaves a
              // blank line between them, and run together they read as one.
              dangerouslySetInnerHTML={{ __html: marked.parse(laidOut, { async: false, breaks: true }) }}
            />
          ) : (
            // A line said to the question before this one stays where it is —
            // an emptied box reads as her having left the room — but it fades
            // back so it is plainly the last thing she said and not an answer
            // to what was just asked.
            <div
              className={`min-h-[2.2em] text-lg leading-[1.8] transition-colors duration-500 ${
                isPast ? 'text-foreground/35' : 'text-foreground'
              }`}
            >
              {/* Her line is speech, so only the marks that fit inside a spoken
                  sentence are read — bold, a code span, a link. Headings and
                  lists belong to a laid-out answer above, and anything longer
                  than that she hands over as a report. Without this the box
                  read markdown when she laid something out and printed the
                  asterisks when she spoke, which flipped mid-conversation. */}
              <span dangerouslySetInnerHTML={{ __html: marked.parseInline(line, { async: false }) }} />
              {isTyping && (
                <span className="ml-0.5 inline-block h-[1em] w-0.5 -translate-y-0.5 animate-[caret-blink_1s_step-end_infinite] bg-foreground align-middle" />
              )}
            </div>
          )}
          </div>

          {/* The corner opposite the page-turning, and one thing at a time in
              it: while she works, that she is still at it; when she stops, the
              mood she signed off with, written out the way she writes it. Both
              belong to the line rather than over it, so they sit in the margin
              the box already leaves. */}
          <div className="absolute bottom-3 left-6.5">
            {isLoading ? (
              <WaitingLine words={waiting} outputTokens={outputTokens} />
            ) : (
              mood && <span className="text-sm whitespace-nowrap text-foreground">{mood}</span>
            )}
          </div>

          {/* Who turns the page, in the corner she turns it from: AUTO hands
              the turning over, and the triangle is the master doing it himself
              — the only thing to press, since her line is dialogue and not a
              button. */}
          <div className="absolute right-6 bottom-3 flex items-center gap-1.5">
            {/* A blinking triangle is a thing the master has to have been
                taught, so it says the rest in words: how many she still has
                waiting, and the key that brings the next one. It grows out of
                AUTO's left rather than holding a slot of its own, so nothing
                beside it moves when it leaves and the corner is empty rather
                than blank. */}
            {queued > 0 && !isTyping && (
              <button
                type="button"
                aria-keyshortcuts="Space"
                onClick={onAdvance}
                className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 py-1 pr-2 pl-2.5 text-primary transition-colors hover:bg-primary/20"
              >
                <span className="text-xs leading-none font-medium">
                  {queued === 1 ? t.oneMore : fill(t.more, { count: queued })}
                </span>
                <kbd className="rounded-sm border border-primary/30 px-1 py-0.5 font-mono text-[11px] leading-none">
                  space
                </kbd>
                <span className="block h-0 w-0 animate-[tri-blink_1.1s_ease-in-out_infinite] border-t-[11px] border-r-[7px] border-l-[7px] border-t-primary border-r-transparent border-l-transparent" />
              </button>
            )}
            <button
              type="button"
              aria-pressed={pace === 'auto'}
              title={t.autoPace}
              onClick={() => onPace(pace === 'auto' ? 'manual' : 'auto')}
              className={`rounded px-1.5 py-1 font-mono text-[10px] leading-none tracking-[0.14em] uppercase transition-colors ${
                pace === 'auto'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground/50 hover:text-foreground'
              }`}
            >
              auto
            </button>
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
