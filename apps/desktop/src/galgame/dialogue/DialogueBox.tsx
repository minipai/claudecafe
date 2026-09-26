import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { marked } from 'marked'
import { NamePlate } from './NamePlate'
import { WaitingLine } from './WaitingLine'
import type { Todo } from '@/agent'
import type { Pace } from './useSpeech'
import { fill, her, text } from '@/i18n'

type DialogueBoxProps = {
  line: string
  isTyping: boolean
  streamed: boolean
  /** Whether the line in the box was said before the question just asked. */
  isPast: boolean
  /** An answer with shape to it — markdown, laid out in place of the typed line. */
  laidOut: string | null
  isLoading: boolean
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
  /** Her task list while she works — it is read in the reply window. */
  todos: Todo[]
  /** Opens her answer, whole, in a window of its own. */
  onOpenReply: () => void
  /** Pressing her name plate opens the maid picker for the next conversation. */
  onOpenPersona: () => void
  footer: ReactNode
  controls: ReactNode
  utility: ReactNode
}

/**
 * The galgame dialogue panel — one frame holding the spoken line on top and
   * the composer below the action row. Short-tier replies just type into
 * it in place, and it grows/shrinks in place for the medium tier. It shares
 * a layoutId with PlanView so Motion morphs it into the panel a folded-out
 * plan is read in instead of it being a separate transition.
 */
export function DialogueBox({
  line,
  isTyping,
  streamed,
  isPast,
  laidOut,
  isLoading,
  waiting,
  outputTokens,
  queued,
  onAdvance,
  pace,
  onPace,
  todos,
  onOpenReply,
  onOpenPersona,
  footer,
  controls,
  utility,
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

  // Whether what she said runs past the box, so the master is told there is a
  // window it fits in. The box's cap is a share of the window's height, so a
  // resize can change the answer as much as a new line can.
  const [overflowing, setOverflowing] = useState(false)
  useEffect(() => {
    const measure = () => {
      const box = said.current
      setOverflowing(!!box && box.scrollHeight > box.clientHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [line, laidOut])

  return (
    <motion.div
      layout
      layoutId="dialogue-frame"
      transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
      className="dialogue-card relative w-full rounded-[24px] border border-border bg-card/96 shadow-[0_16px_42px_#33202528] backdrop-blur-[18px]"
    >
      <div className="absolute -top-4 left-6 right-4 z-10 flex items-center">
        <NamePlate name={her()} onOpen={onOpenPersona} />
        <div className="-ml-3 min-w-0">{utility}</div>
      </div>

      <motion.div layout className="relative overflow-hidden px-6 pt-7 pb-3">
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
              // It fades back once it is no longer the answer to the question
              // just asked, the same as a spoken line does — what it says stops
              // being current, but how it was written stays as it was written.
              // Faded whole rather than by text colour: `.report-md` sets its
              // own colour and beats a utility class, and the code spans in it
              // carry a background that has to go back with the words.
              className={`report-md text-base leading-[1.9] transition-opacity duration-500 ${
                isPast ? 'opacity-35' : 'opacity-100'
              }`}
              // Single line breaks are kept, the same as the log does: she
              // writes a line per point as often as she leaves a
              // blank line between them, and run together they read as one.
              dangerouslySetInnerHTML={{ __html: marked.parse(laidOut, { async: false, breaks: true }) }}
            />
          ) : (
            // A line said to the question before this one stays where it is —
            // an emptied box reads as her having left the room — but it fades
            // back so it is plainly the last thing she said and not an answer
            // to what was just asked.
            <div
              // Keep room for two lines so short replies have a steady frame.
              className={`min-h-[3.44em] text-[17px] leading-[1.72] transition-colors duration-500 ${
                isPast ? 'text-foreground/35' : 'text-foreground'
              }`}
            >
              {/* Her line is speech, so only the marks that fit inside a spoken
                  sentence are read — bold, a code span, a link. Headings and
                  lists belong to a laid-out answer above. Without this the box
                  read markdown when she laid something out and printed the
                  asterisks when she spoke, which flipped mid-conversation. */}
              <div
                className={streamed ? 'report-md' : undefined}
                dangerouslySetInnerHTML={{
                  __html: streamed
                    ? marked.parse(line, { async: false, breaks: true })
                    : marked.parseInline(line, { async: false }),
                }}
              />
              {isTyping && (
                <span className="ml-0.5 inline-block h-[1em] w-0.5 -translate-y-0.5 animate-[caret-blink_1s_step-end_infinite] bg-foreground align-middle" />
              )}
            </div>
          )}
          </div>

          {isLoading && (
            <div className="mt-2">
              <WaitingLine words={waiting} outputTokens={outputTokens} />
            </div>
          )}
      </motion.div>

      <motion.div layout className="flex items-center justify-between gap-2 px-6 pb-2">
        <div className="flex items-center gap-1.5">
            {/* A blinking triangle is a thing the master has to have been
                taught, so it says the rest in words: how many she still has
                waiting, and the key that brings the next one. It grows out of
                AUTO's left rather than holding a slot of its own, so nothing
                beside it moves when it leaves and the corner is empty rather
                than blank. */}
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
            {/* The way to the reply window, and to her task list in it: while
                she has a list, it says how far along she is. */}
            {(todos.length > 0 || overflowing) && (
              <button
                type="button"
                onClick={onOpenReply}
                className="rounded px-1.5 py-1 text-xs leading-none text-muted-foreground transition-colors hover:text-foreground"
              >
                {todos.length > 0
                  ? `${t.tasks} ${todos.filter((todo) => todo.status === 'completed').length}/${todos.length}`
                  : t.openReply}{' '}
                ↗
              </button>
            )}
        </div>
        {controls}
      </motion.div>

      <motion.div layout className="flex flex-col">
        {footer}
      </motion.div>
    </motion.div>
  )
}
