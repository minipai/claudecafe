import { useCallback, useEffect, useRef, useState } from 'react'

const TYPE_SPEED_MS = 34

/** Types a line of dialogue one character at a time, galgame-style. */
export function useTypewriter() {
  const [line, setLine] = useState('')
  const [isDone, setIsDone] = useState(false)
  const timerRef = useRef<number | null>(null)

  // The scene the interval was typing into may be gone before the line is —
  // a session torn down mid-word must not leave it setting state on nobody.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
  }, [])

  const typeLine = useCallback((text: string, onDone?: () => void) => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
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
