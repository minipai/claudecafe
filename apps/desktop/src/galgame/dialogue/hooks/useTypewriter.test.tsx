// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTypewriter } from './useTypewriter'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useTypewriter', () => {
  it('starts empty and not done', () => {
    const { result } = renderHook(() => useTypewriter())
    expect(result.current.line).toBe('')
    expect(result.current.isDone).toBe(false)
  })

  it('types the line one character at a time and finishes', () => {
    const onDone = vi.fn()
    const { result } = renderHook(() => useTypewriter())

    act(() => result.current.typeLine('hi!', onDone))
    expect(result.current.line).toBe('')
    expect(result.current.isDone).toBe(false)

    act(() => vi.advanceTimersByTime(34))
    expect(result.current.line).toBe('h')

    act(() => vi.advanceTimersByTime(34))
    expect(result.current.line).toBe('hi')

    act(() => vi.advanceTimersByTime(34))
    expect(result.current.line).toBe('hi!')
    expect(result.current.isDone).toBe(true)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('starting a new line before the old one finishes cuts it short and starts over', () => {
    const { result } = renderHook(() => useTypewriter())

    act(() => result.current.typeLine('a long first line'))
    act(() => vi.advanceTimersByTime(34 * 3))
    expect(result.current.line).toBe('a l')

    act(() => result.current.typeLine('new'))
    expect(result.current.line).toBe('')
    expect(result.current.isDone).toBe(false)

    act(() => vi.advanceTimersByTime(34 * 3))
    expect(result.current.line).toBe('new')
    expect(result.current.isDone).toBe(true)
  })

  it('clears its interval on unmount, so a gone box is never typed into again', () => {
    const clearSpy = vi.spyOn(window, 'clearInterval')
    const { result, unmount } = renderHook(() => useTypewriter())

    act(() => result.current.typeLine('a long line, still typing when it goes'))
    act(() => vi.advanceTimersByTime(34 * 3))
    clearSpy.mockClear()

    unmount()
    expect(clearSpy).toHaveBeenCalledOnce()

    // Nothing left running at all — a spy on clearInterval only proves this
    // one cleanup fired, not that nothing else is still ticking behind it.
    expect(vi.getTimerCount()).toBe(0)
  })
})
