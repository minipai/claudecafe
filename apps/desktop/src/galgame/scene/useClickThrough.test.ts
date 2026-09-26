// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CafeBridge } from '@/agent'
import { useClickThrough } from './useClickThrough'

afterEach(() => {
  delete (window as { cafe?: unknown }).cafe
  document.body.style.pointerEvents = ''
  vi.restoreAllMocks()
})

function createBridge() {
  return {
    clickThrough: vi.fn(),
    followPointer: vi.fn(() => () => {}),
  } as unknown as CafeBridge
}

describe('useClickThrough', () => {
  it('asserts the pointer is not being ignored on mount, the same as it does on the way out — a reload must not leave the two out of step', () => {
    const bridge = createBridge()
    ;(window as unknown as { cafe: CafeBridge }).cafe = bridge

    const { unmount } = renderHook(() => useClickThrough())
    expect(bridge.clickThrough).toHaveBeenCalledWith(false)

    unmount()
    expect(bridge.clickThrough).toHaveBeenCalledTimes(2)
  })

  it('stays solid while an open menu holds the rest of the page pointer-inert', () => {
    // A Radix menu sets pointer-events: none on the body so an outside click
    // dismisses it — hit-testing then sees air everywhere, and without the
    // guard the click on another button fell through to the app behind.
    const bridge = createBridge()
    ;(window as unknown as { cafe: CafeBridge }).cafe = bridge
    document.elementsFromPoint = vi.fn(() => [])

    renderHook(() => useClickThrough())
    document.body.style.pointerEvents = 'none'
    fireEvent.mouseMove(window, { clientX: 10, clientY: 10 })
    expect(bridge.clickThrough).not.toHaveBeenCalledWith(true)

    // The menu closed: genuinely empty space goes back to being let through.
    document.body.style.pointerEvents = ''
    fireEvent.mouseMove(window, { clientX: 10, clientY: 10 })
    expect(bridge.clickThrough).toHaveBeenCalledWith(true)
  })
})
