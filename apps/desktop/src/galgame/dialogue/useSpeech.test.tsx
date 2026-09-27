// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeech } from './useSpeech'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useSpeech', () => {
  it('shows complete lines immediately and calls onDone once', () => {
    const onShow = vi.fn()
    const onDone = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('hello there', { onShow, onDone }))
    expect(onShow).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledOnce()
    expect(result.current.queued).toBe(0)
    expect(result.current.line).toBe('hello there')
    expect(result.current.isDone).toBe(true)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('renders cumulative stream snapshots immediately, updates queued snapshots in place, and completes without typing', () => {
    const { result } = renderHook(() => useSpeech())
    act(() => result.current.stream('one', 'live', false))
    expect(result.current.line).toBe('live')
    expect(result.current.isDone).toBe(false)
    act(() => result.current.stream('two', 'front', false))
    act(() => result.current.stream('two', 'front page', true))
    expect(result.current.queued).toBe(1)
    act(() => result.current.advance())
    expect(result.current.line).toBe('front page')
    expect(result.current.isDone).toBe(true)
  })

  it('applies the latest active stream hooks but keeps queued stream hooks dormant until shown', () => {
    const firstMood = vi.fn()
    const finalMood = vi.fn()
    const queuedMood = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.stream('active', 'part', false, { onShow: firstMood }))
    act(() => result.current.stream('active', 'complete', true, { onShow: finalMood }))
    expect(finalMood).toHaveBeenCalledOnce()

    act(() => result.current.stream('queued', 'queued part', false, { onShow: queuedMood }))
    act(() => result.current.stream('queued', 'queued complete', true, { onShow: queuedMood }))
    expect(queuedMood).not.toHaveBeenCalled()

    act(() => result.current.advance())
    expect(queuedMood).toHaveBeenCalledOnce()
    expect(result.current.line).toBe('queued complete')
  })

  it('does not requeue a stream snapshot that arrives after advancing past that stream', () => {
    const { result } = renderHook(() => useSpeech())
    act(() => result.current.stream('read', 'already read', true))
    act(() => result.current.stream('next', 'next line', true))
    act(() => result.current.advance())

    act(() => result.current.stream('read', 'late canonical snapshot', true))

    expect(result.current.line).toBe('next line')
    expect(result.current.queued).toBe(0)
  })

  it('discards late snapshots after clear while still dropping queued permission hooks', () => {
    const onDrop = vi.fn()
    const { result } = renderHook(() => useSpeech())
    act(() => result.current.stream('live', 'partial', false))
    act(() => result.current.say('permission', { onDrop }))
    act(() => result.current.clear())
    act(() => result.current.stream('live', 'resurrected', true))
    expect(result.current.line).toBe('partial')
    expect(onDrop).toHaveBeenCalledOnce()
  })

  it('queues a second line behind the one already showing, and reveals it on advance', () => {
    const onShow2 = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.say('second', { onShow: onShow2 }))
    expect(result.current.queued).toBe(1)
    expect(onShow2).not.toHaveBeenCalled()

    expect(result.current.line).toBe('first')

    act(() => result.current.advance())
    expect(onShow2).toHaveBeenCalledOnce()
    expect(result.current.queued).toBe(0)
    expect(result.current.line).toBe('second')
    expect(result.current.isDone).toBe(true)
  })

  it('runs an act at once when nothing is already showing', () => {
    const play = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.act(play))
    expect(play).toHaveBeenCalledOnce()
  })

  it('runs a trailing act once the complete showing line leaves nothing for it to wait on', () => {
    const play = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.act(play))
    // An act in the queue is not a line waiting to be read.
    expect(result.current.queued).toBe(0)
    expect(play).toHaveBeenCalledOnce()
  })

  it('cut drops whatever was queued and takes the box immediately', () => {
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.say('second'))
    expect(result.current.queued).toBe(1)

    act(() => result.current.cut('urgent'))
    expect(result.current.queued).toBe(0)
    expect(result.current.isDone).toBe(true)
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

  it('drains a trailing act once the complete line ahead of it is shown', () => {
    const play = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.act(play))
    // Not counted as queued — the doc comment's own promise — so nothing yet
    // renders an advance button for it to wait on.
    expect(result.current.queued).toBe(0)
    expect(play).toHaveBeenCalledOnce()
  })

  it('turns the page after the reading delay in auto pace', () => {
    const onShow2 = vi.fn()
    const { result } = renderHook(() => useSpeech())

    act(() => result.current.say('first'))
    act(() => result.current.say('second', { onShow: onShow2 }))
    act(() => result.current.setPace('auto'))

    expect(result.current.line).toBe('first')
    expect(onShow2).not.toHaveBeenCalled()

    // The auto-advance timer is keyed to the length of the line just shown.
    act(() => vi.advanceTimersByTime(900 + 'first'.length * 22))
    expect(onShow2).toHaveBeenCalledOnce()
  })
})
