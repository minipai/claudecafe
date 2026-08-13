import { useCallback, useEffect, useRef, useState } from 'react'
import { useTypewriter } from './useTypewriter'

/**
 * What the scene is made of. A `line` is spoken — `onShow` fires when it takes
 * the box, `onDone` when it has finished typing itself out. An `act` is
 * everything that happens between two lines: her face changing, a whisper of
 * what she just did. Acts are not clicked through; they play on the way past.
 *
 * `halt` marks the one kind of line the master cannot be carried past: a
 * question, a permission. Auto-play and skipping both stop there.
 */
type Beat =
  | { kind: 'line'; text: string; halt?: boolean; onShow?: () => void; onDone?: () => void }
  | { kind: 'act'; play: () => void }

export type Hooks = { onShow?: () => void; onDone?: () => void; halt?: boolean }

/** Who is turning the pages: the master, a timer, or nobody at all. */
export type Pace = 'manual' | 'auto' | 'skip'

/** Long enough that the acts in between still register as having happened. */
const SKIP_PAUSE_MS = 90
/** Typing already gave him most of the line; this is the beat after the period. */
const AUTO_PAUSE_MS = 900
const AUTO_PER_CHAR_MS = 22
const AUTO_MAX_MS = 4200

/**
 * She speaks one line at a time, the way a galgame does.
 *
 * A turn is not one utterance: she says something, goes off to read a file,
 * comes back and says something else, all before the answer. Each of those is a
 * line, and a line already in the box is never written over — the next one waits
 * behind it until the master clicks on. What he never saw, he never missed.
 *
 * Nothing jumps the queue, not even a question waiting on an answer: what she
 * said on the way to asking it is often the reason the answer is yes. `cut` is
 * only for a scene that no longer has a before — the opening greeting, a fresh
 * session. `clear` is the master moving on himself: sending a prompt drops
 * whatever was still queued and frees the box.
 */
export function useSpeech() {
  const { line, isDone, typeLine } = useTypewriter()
  const queue = useRef<Beat[]>([])
  /** Whether the box is taken. Empty until the first line, and freed whenever
   * the master moves the scene on himself. */
  const taken = useRef(false)
  /** How many lines are waiting. Acts in between are not counted: they play on
   * the way to the next line, so on their own there is nothing to click for. */
  const [queued, setQueued] = useState(0)
  const [pace, setPaceState] = useState<Pace>('manual')
  /** The same thing, readable from inside a beat that is playing right now. */
  const paceRef = useRef<Pace>('manual')

  const setPace = useCallback((next: Pace) => {
    paceRef.current = next
    setPaceState(next)
  }, [])

  const count = () => queue.current.filter((beat) => beat.kind === 'line').length

  const show = useCallback(
    (beat: Extract<Beat, { kind: 'line' }>) => {
      taken.current = true
      // A question hands the scene back: nothing may carry him past the one
      // line he has to answer himself, so it is typed out like any other.
      if (beat.halt && paceRef.current !== 'manual') setPace('manual')
      beat.onShow?.()
      typeLine(beat.text, beat.onDone, paceRef.current === 'skip')
    },
    [setPace, typeLine],
  )

  const push = useCallback(
    (beat: Beat) => {
      queue.current.push(beat)
      setQueued(count())
    },
    [],
  )

  const say = useCallback(
    (text: string, hooks: Hooks = {}) => {
      if (taken.current) return push({ kind: 'line', text, ...hooks })
      show({ kind: 'line', text, ...hooks })
    },
    [push, show],
  )

  /**
   * Something that happens beside the line rather than in it — a face she puts
   * on, a whisper of what she is doing. It belongs where it arrived, which is
   * after the line in the box and before the one that follows it: a face put on
   * for what she is about to say must not appear over what she just said.
   */
  const act = useCallback(
    (play: () => void) => {
      if (taken.current) return push({ kind: 'act', play })
      play()
    },
    [push],
  )

  const cut = useCallback(
    (text: string, hooks: Hooks = {}) => {
      queue.current = []
      setQueued(0)
      show({ kind: 'line', text, ...hooks })
    },
    [show],
  )

  const clear = useCallback(() => {
    queue.current = []
    taken.current = false
    setQueued(0)
  }, [])

  /** On to the next line, playing whatever happened in between on the way. */
  const advance = useCallback(() => {
    for (;;) {
      const next = queue.current.shift()
      setQueued(count())
      if (!next) return
      if (next.kind === 'act') {
        next.play()
        continue
      }
      show(next)
      return
    }
  }, [show])

  /** Nobody is clicking: the page turns itself, quickly when skipping and at
   * reading speed on auto. Either way it only ever turns onto a line that is
   * already waiting — it never pushes her to say more. */
  useEffect(() => {
    if (pace === 'manual' || !isDone || queued === 0) return
    const wait =
      pace === 'skip'
        ? SKIP_PAUSE_MS
        : Math.min(AUTO_MAX_MS, AUTO_PAUSE_MS + line.length * AUTO_PER_CHAR_MS)
    const timer = window.setTimeout(advance, wait)
    return () => window.clearTimeout(timer)
  }, [pace, isDone, queued, line, advance])

  return { line, isDone, say, act, cut, clear, advance, hasMore: queued > 0, pace, setPace }
}
