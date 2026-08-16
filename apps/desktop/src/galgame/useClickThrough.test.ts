// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CafeBridge } from '@/agent'
import { useClickThrough } from './useClickThrough'

afterEach(() => {
  delete (window as { cafe?: unknown }).cafe
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
})
