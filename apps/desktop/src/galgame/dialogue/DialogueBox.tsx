import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { renderInlineMarkdown, renderMarkdown } from '@/lib/markdown'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NamePlate } from './NamePlate'
import { WaitingLine } from './WaitingLine'
import type { Todo } from '@/agent'
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
  pageIndex: number
  pageCount: number
  canPrevious: boolean
  canNext: boolean
  unreadNext: boolean
  canAutofocusReadNext: boolean
  composing: boolean
  navigationBlocked: boolean
  onPrevious: () => void
  onAdvance: () => void
  onReadNext: () => void
  /** Her task list while she works — it is read in the reply window. */
  todos: Todo[]
  /** Opens her answer, whole, in a window of its own. */
  onOpenReply: () => void
  /** Pressing her name plate opens the maid picker for the next conversation. */
  onOpenPersona: () => void
  footer: ReactNode
  controls: ReactNode
  onOpenHistory: () => void
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
  pageIndex,
  pageCount,
  canPrevious,
  canNext,
  unreadNext,
  canAutofocusReadNext,
  composing,
  navigationBlocked,
  onPrevious,
  onAdvance,
  onReadNext,
  todos,
  onOpenReply,
  onOpenPersona,
  footer,
  controls,
  onOpenHistory,
  utility,
}: DialogueBoxProps) {
  const t = text().scene
  const said = useRef<HTMLDivElement>(null)
  const readNext = useRef<HTMLButtonElement>(null)
  const previousFocusState = useRef({ unreadNext, canNext, composing, navigationBlocked })
  useEffect(() => {
    const before = previousFocusState.current
    const pageArrived = unreadNext && !before.unreadNext
    const navigationBecameAvailable = unreadNext && canNext && !before.canNext
    const compositionEnded = unreadNext && before.composing && !composing
    if (canAutofocusReadNext && !navigationBlocked && (pageArrived || navigationBecameAvailable || compositionEnded)) readNext.current?.focus()
    previousFocusState.current = { unreadNext, canNext, composing, navigationBlocked }
  }, [unreadNext, canNext, canAutofocusReadNext, composing, navigationBlocked])

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
              dangerouslySetInnerHTML={{ __html: renderMarkdown(laidOut) }}
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
                    ? renderMarkdown(line)
                    : renderInlineMarkdown(line),
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

      <motion.div layout className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-6 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
            <form onSubmit={(event) => { event.preventDefault(); onPrevious() }}>
              <button type="submit" aria-label={t.previousMessage} title={`${t.previousMessage} (⌘[)`} disabled={!canPrevious} className="rounded p-1 text-muted-foreground transition-colors enabled:hover:text-foreground disabled:opacity-35"><ChevronLeft aria-hidden="true" size={16} /></button>
            </form>
            <span aria-label={fill(t.messageCounter, { current: pageIndex, total: pageCount })} className="min-w-8 text-center text-xs tabular-nums text-muted-foreground">{pageIndex}/{pageCount}</span>
            <form onSubmit={(event) => { event.preventDefault(); onAdvance() }}>
              <button type="submit" aria-label={t.nextMessage} title={`${t.nextMessage} (⌘])`} disabled={!canNext} className="rounded p-1 text-muted-foreground transition-colors enabled:hover:text-foreground disabled:opacity-35"><ChevronRight aria-hidden="true" size={16} /></button>
            </form>
            <form onSubmit={(event) => { event.preventDefault(); onOpenHistory() }}>
              <button type="submit" className="h-7 cursor-pointer border-0 bg-transparent px-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label={t.openHistory} title={t.history}>{t.logAction}</button>
            </form>
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
                <span aria-hidden="true">↗</span>
              </button>
            )}
        </div>
        <div className="justify-self-end">{controls}</div>
        <form className="col-start-2 row-start-1" onSubmit={(event) => { event.preventDefault(); if (canAutofocusReadNext) onReadNext() }}>
          {unreadNext && (
            <button ref={readNext} type="submit" aria-label={t.readNextMessage} disabled={!canAutofocusReadNext} className="whitespace-nowrap rounded-full border border-border bg-background/80 px-4 py-1.5 text-sm text-foreground transition-colors enabled:hover:bg-muted disabled:cursor-wait disabled:opacity-60" title={`${t.readNextMessage} (Space)`}>
              {t.readNextMessage} <kbd className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Space</kbd>
            </button>
          )}
        </form>
      </motion.div>

      <motion.div layout className="flex flex-col">
        {footer}
      </motion.div>
    </motion.div>
  )
}
