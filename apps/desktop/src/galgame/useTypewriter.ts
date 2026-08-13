import { useCallback, useRef, useState } from 'react'

const TYPE_SPEED_MS = 34

/** Types a line of dialogue one character at a time, galgame-style. */
export function useTypewriter() {
  const [line, setLine] = useState('')
  const [isDone, setIsDone] = useState(false)
  const timerRef = useRef<number | null>(null)

  /** `instant` is the line arriving already written — skipping past it, the
   * master having decided he does not need to watch her say this one. */
  const typeLine = useCallback((text: string, onDone?: () => void, instant = false) => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
    if (instant) {
      setLine(text)
      setIsDone(true)
      onDone?.()
      return
    }
    setIsDone(false)
    setLine('')
    let i = 0
    timerRef.current = window.setInterval(() => {
      i++
      setLine(text.slice(0, i))
      if (i >= text.length) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current)
        timerRef.current = null
        setIsDone(true)
        onDone?.()
      }
    }, TYPE_SPEED_MS)
  }, [])

  return { line, isDone, typeLine }
}
