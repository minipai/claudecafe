import { useCallback, useRef, useState } from 'react'

type Beat =
  | {
      kind: 'line'
      streamId?: string
      done?: boolean
      text: string
      halt?: boolean
      onShow?: () => void
      onDone?: () => void
      onDrop?: () => void
      shown?: boolean
      completed?: boolean
    }
  | { kind: 'act'; play: () => void }

export type Hooks = {
  onShow?: () => void
  onDone?: () => void
  halt?: boolean
  onDrop?: () => void
}

export function useSpeech() {
  const [line, setLine] = useState('')
  const [isDone, setIsDone] = useState(false)
  const [past, setPast] = useState(false)
  const [streamed, setStreamed] = useState(false)
  const [queued, setQueued] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [canPrevious, setCanPrevious] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [canReadNext, setCanReadNext] = useState(false)
  const queue = useRef<Beat[]>([])
  const pages = useRef<Extract<Beat, { kind: 'line' }>[]>([])
  const cursor = useRef(-1)
  const taken = useRef(false)
  const discardedStreams = useRef(new Set<string>())

  const updateNavigation = useCallback(() => {
    const visiblePage = pages.current[cursor.current]
    const visibleDone = visiblePage ? visiblePage.done ?? true : false
    const queuedLines = queue.current.filter((beat) => beat.kind === 'line').length
    const latestDone = pages.current.at(-1)?.done ?? true
    setPageCount(pages.current.length + queuedLines)
    setPageIndex(cursor.current < 0 ? 0 : cursor.current + 1)
    setCanPrevious(cursor.current > 0)
    setCanNext(cursor.current + 1 < pages.current.length || (cursor.current === pages.current.length - 1 && visibleDone && queuedLines > 0))
    setCanReadNext(queuedLines > 0 && latestDone)
  }, [])

  const playTrailingActs = useCallback(() => {
    if (queue.current.length === 0 || queue.current.some((beat) => beat.kind !== 'act')) return
    for (const beat of queue.current) {
      if (beat.kind === 'act') beat.play()
    }
    queue.current = []
    setQueued(0)
    updateNavigation()
  }, [updateNavigation])

  const present = useCallback((index: number) => {
    const beat = pages.current[index]
    if (!beat) return
    cursor.current = index
    taken.current = true
    setPast(false)
    setStreamed(!!beat.streamId)
    setLine(beat.text)
    setIsDone(beat.streamId ? beat.done ?? false : true)
    if (!beat.shown) {
      beat.shown = true
      beat.onShow?.()
    }
    if ((beat.done ?? true) && !beat.completed) {
      beat.completed = true
      beat.onDone?.()
    }
    updateNavigation()
  }, [updateNavigation])

  const runQueue = useCallback(() => {
    for (;;) {
      const beat = queue.current.shift()
      setQueued(queue.current.filter((item) => item.kind === 'line').length)
      if (!beat) return
      if (beat.kind === 'act') {
        beat.play()
        continue
      }
      pages.current.push(beat)
      present(pages.current.length - 1)
      if (beat.done ?? true) playTrailingActs()
      return
    }
  }, [playTrailingActs, present])

  const enqueue = useCallback((beat: Beat) => {
    queue.current.push(beat)
    setQueued(queue.current.filter((item) => item.kind === 'line').length)
    updateNavigation()
  }, [updateNavigation])

  const say = useCallback((text: string, hooks: Hooks = {}) => {
    const beat: Extract<Beat, { kind: 'line' }> = { kind: 'line', text, ...hooks }
    if (taken.current) enqueue(beat)
    else {
      pages.current.push(beat)
      present(pages.current.length - 1)
    }
  }, [enqueue, present])

  const restore = useCallback((texts: string[]) => {
    for (const beat of pages.current) {
      if (beat.streamId) discardedStreams.current.add(beat.streamId)
    }
    for (const beat of queue.current) if (beat.kind === 'line') {
      if (beat.streamId) discardedStreams.current.add(beat.streamId)
      beat.onDrop?.()
    }
    queue.current = []
    setQueued(0)
    pages.current = texts.map((text) => ({ kind: 'line', text, done: true, shown: true, completed: true }))
    cursor.current = pages.current.length - 1
    taken.current = pages.current.length > 0
    setPast(pages.current.length === 0)
    setLine(pages.current[cursor.current]?.text ?? '')
    setStreamed(false)
    setIsDone(true)
    updateNavigation()
  }, [updateNavigation])

  const beginTurn = useCallback((replaceOpening = false) => {
    if (replaceOpening && pages.current.length === 1 && cursor.current === 0) {
      for (const beat of pages.current) if (beat.streamId) discardedStreams.current.add(beat.streamId)
      pages.current = []
      cursor.current = -1
      taken.current = false
      setPageCount(0)
      setPageIndex(0)
      setCanPrevious(false)
      setCanNext(false)
    }
    if (cursor.current === pages.current.length - 1) taken.current = false
    setPast(true)
  }, [])

  const stream = useCallback((id: string, text: string, done: boolean, hooks: Hooks = {}) => {
    if (discardedStreams.current.has(id)) return
    const queuedBeat = queue.current.find((beat) => beat.kind === 'line' && beat.streamId === id)
    if (queuedBeat?.kind === 'line') {
      queuedBeat.text = text
      queuedBeat.done = done
      queuedBeat.onShow = hooks.onShow ?? queuedBeat.onShow
      updateNavigation()
      return
    }
    const index = pages.current.findIndex((beat) => beat.streamId === id)
    if (index >= 0) {
      const beat = pages.current[index]
      beat.text = text
      beat.done = done
      beat.onShow = hooks.onShow ?? beat.onShow
      if (index === cursor.current) {
        setLine(text)
        setIsDone(done)
        if (hooks.onShow && beat.shown) hooks.onShow()
        if (done && !beat.completed) {
          beat.completed = true
          beat.onDone?.()
        }
      }
      if (done && index === pages.current.length - 1) playTrailingActs()
      updateNavigation()
      return
    }
    const beat: Extract<Beat, { kind: 'line' }> = { kind: 'line', streamId: id, text, done, ...hooks }
    if (taken.current) enqueue(beat)
    else {
      pages.current.push(beat)
      present(pages.current.length - 1)
    }
  }, [enqueue, playTrailingActs, present, updateNavigation])

  const act = useCallback((play: () => void) => {
    if (taken.current) {
      enqueue({ kind: 'act', play })
      const latestPage = pages.current.at(-1)
      if (latestPage && (latestPage.done ?? true)) playTrailingActs()
    }
    else play()
  }, [enqueue, playTrailingActs])

  const discardQueue = useCallback(() => {
    for (const beat of queue.current) if (beat.kind === 'line') {
      if (beat.streamId) discardedStreams.current.add(beat.streamId)
      beat.onDrop?.()
    }
    queue.current = []
    setQueued(0)
    updateNavigation()
  }, [updateNavigation])

  const cut = useCallback((text: string, hooks: Hooks = {}) => {
    discardQueue()
    for (const beat of pages.current) {
      if (beat.streamId) discardedStreams.current.add(beat.streamId)
    }
    pages.current = []
    cursor.current = -1
    taken.current = false
    pages.current.push({ kind: 'line', text, ...hooks })
    present(0)
  }, [discardQueue, present])

  const clear = useCallback(() => {
    discardQueue()
    for (const beat of pages.current) {
      if (beat.streamId) discardedStreams.current.add(beat.streamId)
    }
    pages.current = []
    cursor.current = -1
    taken.current = false
    setPageCount(0)
    setPageIndex(0)
    setCanPrevious(false)
    setCanNext(false)
    setPast(true)
  }, [discardQueue])

  const advance = useCallback(() => {
    if (cursor.current + 1 < pages.current.length) {
      present(cursor.current + 1)
      return
    }
    const current = pages.current[cursor.current]
    if (current?.streamId && !(current.done ?? false)) return
    runQueue()
  }, [present, runQueue])

  const readNext = useCallback(() => {
    if (queue.current.some((beat) => beat.kind === 'line') && (pages.current.at(-1)?.done ?? true)) runQueue()
  }, [runQueue])

  const previous = useCallback(() => {
    if (cursor.current > 0) present(cursor.current - 1)
  }, [present])

  return { line, isDone, past, streamed, say, stream, act, cut, clear, discardQueue, restore, beginTurn, advance, readNext, canReadNext, queued, previous, canPrevious, canNext, pageIndex, pageCount }
}
