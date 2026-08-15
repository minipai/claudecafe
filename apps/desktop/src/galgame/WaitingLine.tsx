import { useEffect, useState } from 'react'
import { AsteriskIcon } from 'lucide-react'
import { ENGLISH_LINES } from './content'

/** Long enough to be read twice over before it is replaced. */
const WORD_MS = 4500

/**
 * What she says while she is off working — her line, and beside it the two
 * figures the terminal prints: how long she has been at it and how much she has
 * written.
 *
 * It sits in the box's bottom margin rather than in the middle of it, because
 * she talks while she works: a file read, a line back about what she found,
 * then off again. The middle is hers to speak in, and nothing the window says
 * on her behalf may be written over what she actually said.
 */
export function WaitingLine({ words, outputTokens }: { words: string[]; outputTokens: number }) {
  // Her lines are kept between runs, and a set written before she had these has
  // none of them. The window may not go blank over a missing sentence.
  const said = words?.length ? words : ENGLISH_LINES.waiting
  const word = useCycle(said.length, WORD_MS)
  const seconds = useElapsed()

  return (
    // Nothing here wraps or is cut short: her lines are a few words long, and
    // the corner opposite is empty unless there is something waiting in it.
    <div className="pointer-events-none flex items-center gap-2 whitespace-nowrap">
      {/* The terminal's star, drawn rather than typed: the character itself is
          an emoji on this platform and comes out as a coloured blob. */}
      <AsteriskIcon className="size-4 shrink-0 animate-spin text-primary [animation-duration:2.4s]" />
      <span className="text-sm text-muted-foreground">{said[word]}</span>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/60">
        ({seconds}s{outputTokens > 0 && <> · ↓ {outputTokens.toLocaleString()} tokens</>})
      </span>
    </div>
  )
}

/** Which of `length` is showing, moving on every `every` milliseconds. */
function useCycle(length: number, every: number) {
  const [at, setAt] = useState(0)

  useEffect(() => {
    if (length <= 1) return
    const timer = window.setInterval(() => setAt((n) => (n + 1) % length), every)
    return () => window.clearInterval(timer)
  }, [length, every])

  return length ? at % length : 0
}

/** Seconds since this line went up — which is to say, since she started. */
function useElapsed() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return seconds
}
