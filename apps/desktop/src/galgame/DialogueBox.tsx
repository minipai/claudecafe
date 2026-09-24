import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { marked } from 'marked'
import { NamePlate } from './NamePlate'
import { WaitingLine } from './WaitingLine'
import { InnerVoice } from './InnerVoice'
import type { Look } from '@/agent'
import type { Pace } from './useSpeech'
import { fill, her, text } from '@/i18n'

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
  /** The kaomoji standing in for the face she is wearing, when that face has
   * no artwork behind it. Absent whenever the artwork says it itself. */
  standIn: string | null
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
  /** Opens her answer, whole, in a window of its own. */
  onOpenReply: () => void
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
 * a layoutId with PlanView so Motion morphs it into the panel a folded-out
 * plan is read in instead of it being a separate transition.
 */
export function DialogueBox({
  line,
  isTyping,
  isPast,
  laidOut,
  isLoading,
  mood,
  standIn,
  waiting,
  outputTokens,
  queued,
  onAdvance,
  pace,
  onPace,
  onOpenReply,
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
      className="relative w-full rounded-xl border border-border bg-card shadow-md"
    >
      <div className="absolute -top-4 left-6 z-10 flex items-center gap-2.5">
        <NamePlate name={her()} onOpen={onOpenPersona} />
        {/* A face she has no artwork for leaves her standing neutral, so the
            kaomoji says it here instead — next to her name, which is as close
            to her face as the box gets. It goes as soon as she wears a face
            that is drawn. The marker in the corner below is not the same
            thing and does not cover for it: that is how she signed the line,
            and it is behind the waiting line for as long as she is working. */}
        {standIn && (
          <span className="rounded-lg border border-border bg-card px-2 py-1 text-sm whitespace-nowrap text-foreground shadow-md">
            {standIn}
          </span>
        )}
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
              // Two lines' worth even when she has only said one: the backdrop
              // above ends at a fixed height, and a one-line box left a strip of
              // desktop showing between the two.
              className={`min-h-[3.6em] text-lg leading-[1.8] transition-colors duration-500 ${
                isPast ? 'text-foreground/35' : 'text-foreground'
              }`}
            >
              {/* Her line is speech, so only the marks that fit inside a spoken
                  sentence are read — bold, a code span, a link. Headings and
                  lists belong to a laid-out answer above. Without this the box
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
            {overflowing && (
              <button
                type="button"
                onClick={onOpenReply}
                className="rounded px-1.5 py-1 text-xs leading-none text-muted-foreground transition-colors hover:text-foreground"
              >
                {t.openReply} ↗
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

      </motion.div>

      <motion.div layout className="flex flex-col gap-2 border-t border-border px-4 pt-3 pb-3">
        {footer}
      </motion.div>
    </motion.div>
  )
}
