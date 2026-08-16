// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeech } from './useSpeech'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

/** Runs the typewriter to completion for whatever is currently in the box. */
function finishTyping(ms = 34 * 40) {
  act(() => vi.advanceTimersByTime(ms))
}

describe('useSpeech', () => {
  it('says the first line straight into an empty box', () => {
    const onShow = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('hello there', { onShow }))
    expect(onShow).toHaveBeenCalledOnce()
    expect(result.current.queued).toBe(0)
    expect(result.current.isDone).toBe(false)

    finishTyping()
    expect(result.current.line).toBe('hello there')
    expect(result.current.isDone).toBe(true)
  })

  it('queues a second line behind the one already showing, and reveals it on advance', () => {
    const onShow2 = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.say('second', { onShow: onShow2 }))
    expect(result.current.queued).toBe(1)
    expect(onShow2).not.toHaveBeenCalled()

    finishTyping()
    expect(result.current.line).toBe('first')

    act(() => result.current.advance())
    expect(onShow2).toHaveBeenCalledOnce()
    expect(result.current.queued).toBe(0)
    finishTyping()
    expect(result.current.line).toBe('second')
  })

  it('runs an act at once when nothing is already showing', () => {
    const play = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.act(play))
    expect(play).toHaveBeenCalledOnce()
  })

  it('queues an act behind a showing line without counting it as something to click through', () => {
    const play = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.act(play))
    // An act in the queue is not a line waiting to be read.
    expect(result.current.queued).toBe(0)
    expect(play).not.toHaveBeenCalled()

    act(() => result.current.advance())
    expect(play).toHaveBeenCalledOnce()
  })

  it('cut drops whatever was queued and takes the box immediately', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.say('second'))
    expect(result.current.queued).toBe(1)

    act(() => result.current.cut('urgent'))
    expect(result.current.queued).toBe(0)
    expect(result.current.isDone).toBe(false)
    finishTyping()
    expect(result.current.line).toBe('urgent')
  })

  it('clear frees the box, drops the queue, and marks what is left as past', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.say('second'))
    act(() => result.current.clear())

    expect(result.current.queued).toBe(0)
    expect(result.current.past).toBe(true)

    // The box is free again, so the next line is shown at once rather than queued.
    const onShow = vi.fn()
    act(() => result.current.say('third', { onShow }))
    expect(onShow).toHaveBeenCalledOnce()
    expect(result.current.past).toBe(false)
  })

  it('a halted line drops auto pace back to manual as it takes the box', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.setPace('auto'))
    expect(result.current.pace).toBe('auto')

    act(() => result.current.say('a question, waiting on an answer', { halt: true }))
    expect(result.current.pace).toBe('manual')
  })

  it('clear runs onDrop for every queued line, so a beat waiting on an answer is not just thrown away', () => {
    const onDrop = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.say('a question, still waiting its turn', { onDrop }))
    expect(result.current.queued).toBe(1)

    act(() => result.current.clear())
    expect(onDrop).toHaveBeenCalledOnce()
  })

  it('drains a trailing act once the line ahead of it finishes typing, since nothing would ever click it through', () => {
    const play = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.act(play))
    // Not counted as queued — the doc comment's own promise — so nothing yet
    // renders an advance button for it to wait on.
    expect(result.current.queued).toBe(0)
    expect(play).not.toHaveBeenCalled()

    finishTyping()
    expect(play).toHaveBeenCalledOnce()
  })

  it('turns the page on its own once a line is fully typed, in auto pace', () => {
    const onShow2 = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.say('second', { onShow: onShow2 }))
    act(() => result.current.setPace('auto'))

    finishTyping()
    expect(result.current.line).toBe('first')
    expect(onShow2).not.toHaveBeenCalled()

    // The auto-advance timer is keyed to the length of the line just shown.
    act(() => vi.advanceTimersByTime(900 + 'first'.length * 22))
    expect(onShow2).toHaveBeenCalledOnce()
  })
})
