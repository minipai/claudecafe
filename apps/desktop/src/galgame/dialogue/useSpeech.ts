import { useCallback, useEffect, useRef, useState } from 'react'
/**
 * What the scene is made of. A `line` is spoken — `onShow` fires when it takes
 * the box, `onDone` when its complete text is displayed. An `act` is
 * everything that happens between two lines: her face changing, a whisper of
 * what she just did. Acts are not clicked through; they play on the way past.
 *
 * `halt` marks the one kind of line the master cannot be carried past: a
 * question, a permission. Auto-play stops there.
 */
type Beat =
  | {
      kind: 'line'
      streamId?: string
      done?: boolean
      text: string
      halt?: boolean
      onShow?: () => void
      onDone?: () => void
      /** Called instead of `onShow`, for a beat that never gets there — the
       * master moved the scene on himself before it was its turn. A line
       * waiting on an answer (a permission, a question) is a promise on the
       * other end of the bridge; dropped silently, that promise is never
       * kept, and whatever asked it sits parked forever. */
      onDrop?: () => void
    }
  | { kind: 'act'; play: () => void }

export type Hooks = { onShow?: () => void; onDone?: () => void; halt?: boolean; onDrop?: () => void }

/** Who is turning the pages: the master, or a timer. */
export type Pace = 'manual' | 'auto'

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
  const [line, setLine] = useState('')
  const [isDone, setIsDone] = useState(false)
  const queue = useRef<Beat[]>([])
  /** Whether the box is taken. Empty until the first line, and freed whenever
   * the master moves the scene on himself. */
  const taken = useRef(false)
  /** How many lines are waiting. Acts in between are not counted: they play on
   * the way to the next line, so on their own there is nothing to click for. */
  const [queued, setQueued] = useState(0)
  /** Whether what is in the box was said to a question that has already been
   * moved on from. The line stays — an empty box reads as her having left —
   * but it is no longer an answer to what was just asked. */
  const [past, setPast] = useState(false)
  const [streamed, setStreamed] = useState(false)
  const [pace, setPaceState] = useState<Pace>('manual')
  /** The same thing, readable from inside a beat that is playing right now. */
  const paceRef = useRef<Pace>('manual')
  const discardedStreams = useRef(new Set<string>())
  const activeStream = useRef<string | null>(null)

  const setPace = useCallback((next: Pace) => {
    paceRef.current = next
    setPaceState(next)
  }, [])

  const count = () => queue.current.filter((beat) => beat.kind === 'line').length

  /** Whatever is left is acts, with no line behind them to wait for — nothing
   * would ever count them as queued, so nothing would ever click through to
   * them either. */
  const trailingActs = () => queue.current.length > 0 && queue.current.every((beat) => beat.kind === 'act')

  /** Runs a tail of acts the moment there is nothing left for them to wait
   * on — once the line ahead of them is done, or the moment they land behind
   * one already finished. Acts before a further line still wait for the
   * master to click past what is showing now; these have nothing to wait for. */
  const drainTail = useCallback(() => {
    if (!isDone || !trailingActs()) return
    for (const beat of queue.current) if (beat.kind === 'act') beat.play()
    queue.current = []
    setQueued(0)
  }, [isDone])

  const show = useCallback(
    (beat: Extract<Beat, { kind: 'line' }>) => {
      taken.current = true
      setPast(false)
      // A question hands the scene back: nothing may carry him past the one
      // line he has to answer himself.
      if (beat.halt && paceRef.current !== 'manual') setPace('manual')
      beat.onShow?.()
      activeStream.current = beat.streamId ?? null
      setStreamed(!!beat.streamId)
      setLine(beat.text)
      const done = beat.streamId ? beat.done ?? false : true
      setIsDone(done)
      if (done && !beat.streamId) beat.onDone?.()
    },
    [setPace],
  )

  const push = useCallback(
    (beat: Beat) => {
      queue.current.push(beat)
      setQueued(count())
      drainTail()
    },
    [drainTail],
  )

  const say = useCallback(
    (text: string, hooks: Hooks = {}) => {
      if (taken.current) return push({ kind: 'line', text, ...hooks })
      show({ kind: 'line', text, ...hooks })
    },
    [push, show],
  )

  const stream = useCallback((id: string, text: string, done: boolean, hooks: Hooks = {}) => {
    if (discardedStreams.current.has(id)) return
    const existing = queue.current.find((beat) => beat.kind === 'line' && beat.streamId === id)
    if (existing?.kind === 'line') {
      existing.text = text
      existing.done = done
      existing.onShow = hooks.onShow ?? existing.onShow
      return
    }
    if (activeStream.current === id) {
      setLine(text)
      setIsDone(done)
      hooks.onShow?.()
      return
    }
    const beat: Extract<Beat, { kind: 'line' }> = { kind: 'line', streamId: id, text, done, ...hooks }
    if (taken.current) push(beat)
    else show(beat)
  }, [push, show])

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
      for (const beat of queue.current) {
        if (beat.kind === 'line' && beat.streamId) discardedStreams.current.add(beat.streamId)
      }
      if (activeStream.current) discardedStreams.current.add(activeStream.current)
      activeStream.current = null
      queue.current = []
      setQueued(0)
      show({ kind: 'line', text, ...hooks })
    },
    [show],
  )

  const clear = useCallback(() => {
    // The master moving the scene on himself drops whatever was still
    // waiting — but a line with an `onDrop` is not just words: it is a
    // question with someone still waiting on the other end of it, and
    // dropping it silently leaves that wait forever unanswered.
    for (const beat of queue.current) if (beat.kind === 'line') {
      if (beat.streamId) discardedStreams.current.add(beat.streamId)
      beat.onDrop?.()
    }
    if (activeStream.current) discardedStreams.current.add(activeStream.current)
    activeStream.current = null
    queue.current = []
    taken.current = false
    setQueued(0)
    setPast(true)
  }, [])

  /** On to the next line, playing whatever happened in between on the way. */
  const advance = useCallback(() => {
    if (activeStream.current) discardedStreams.current.add(activeStream.current)
    activeStream.current = null
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

  /** The other half of `drainTail`: acts pushed while the line ahead of them
   * was still streaming have nothing to run at push time — this is what catches
   * them once that line finishes without anyone having clicked through. */
  useEffect(() => {
    drainTail()
  }, [drainTail])

  /** Nobody is clicking: the page turns itself at reading speed. It only ever
   * turns onto a line that is already waiting — it never pushes her to say
   * more. */
  useEffect(() => {
    if (pace === 'manual' || !isDone || queued === 0) return
    const wait = Math.min(AUTO_MAX_MS, AUTO_PAUSE_MS + line.length * AUTO_PER_CHAR_MS)
    const timer = window.setTimeout(advance, wait)
    return () => window.clearTimeout(timer)
  }, [pace, isDone, queued, line, advance])

  return { line, isDone, past, streamed, say, stream, act, cut, clear, advance, queued, pace, setPace }
}
