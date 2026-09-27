// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CafeBridge, SceneShare } from '@/agent/bridge'
import { createChatMessage } from '@/galgame/scene/chatlog'

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn()
})

afterEach(() => {
  cleanup()
  delete (window as { cafe?: unknown }).cafe
})

function logOf(overrides: Partial<SceneShare['log']> = {}): SceneShare['log'] {
  return {
    messages: [createChatMessage('assistant', 'welcome back')],
    isBusy: false,
    isCompacting: false,
    isAwaitingAnswer: false,
    ...overrides,
  }
}

/** The window reads its bridge once, on import — so it is put in place first. */
async function mount(log: SceneShare['log'], conversation: string | null = null) {
  const bridge = { sendToScene: vi.fn() } as unknown as CafeBridge
  ;(window as unknown as { cafe: CafeBridge }).cafe = bridge
  vi.resetModules()
  const { LogWindow } = await import('./LogWindow')
  const view = render(<LogWindow log={log} conversation={conversation} />)
  return { bridge, LogWindow, ...view }
}

describe('LogWindow', () => {
  it('hides the resume command until the master has spoken in the conversation', async () => {
    await mount(logOf(), 'fresh-session')
    expect(screen.queryByText('claude --resume fresh-session')).not.toBeInTheDocument()
  })

  it('shows the resume command once the conversation has an id and a word from him', async () => {
    await mount(logOf({ messages: [createChatMessage('user', 'hello')] }), 'session-123')
    expect(screen.getByText('claude --resume session-123')).toBeInTheDocument()
  })

  it('asks the scene to compact, start over, or have him back', async () => {
    const { bridge } = await mount(logOf({ isAwaitingAnswer: true }))

    await act(async () => screen.getByRole('button', { name: /Compact/ }).click())
    await act(async () => screen.getByRole('button', { name: /New conversation/ }).click())
    await act(async () => screen.getByRole('button', { name: /waiting for an answer/ }).click())

    expect(vi.mocked(bridge.sendToScene).mock.calls).toEqual([
      [{ kind: 'compact' }],
      [{ kind: 'new-session' }],
      [{ kind: 'return' }],
    ])
  })

  it('follows appended messages at the bottom, preserves older reading, and resumes on demand', async () => {
    const { rerender, LogWindow } = await mount(logOf())
    const scroller = screen.getByText('welcome back').closest('.overflow-y-auto') as HTMLDivElement
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, writable: true, value: 600 },
    })

    fireEvent.scroll(scroller)
    rerender(<LogWindow log={logOf({ messages: [createChatMessage('assistant', 'welcome back'), createChatMessage('assistant', 'new reply')] })} conversation={null} />)
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 1000 })

    vi.mocked(scroller.scrollTo).mockClear()
    scroller.scrollTop = 200
    fireEvent.scroll(scroller)
    rerender(<LogWindow log={logOf({ messages: [createChatMessage('assistant', 'welcome back'), createChatMessage('assistant', 'new reply'), createChatMessage('assistant', 'stream update')] })} conversation={null} />)
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    expect(scroller.scrollTo).not.toHaveBeenCalled()

    await act(async () => screen.getByRole('button', { name: /latest/i }).click())
    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' })
    vi.mocked(scroller.scrollTo).mockClear()
    rerender(<LogWindow log={logOf({ messages: [createChatMessage('assistant', 'welcome back'), createChatMessage('assistant', 'new reply'), createChatMessage('assistant', 'stream update'), createChatMessage('assistant', 'next update')] })} conversation={null} />)
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 1000 })
  })

  it('resets follow mode and opens the new conversation at its latest message', async () => {
    const { rerender, LogWindow } = await mount(logOf(), 'first')
    const scroller = screen.getByText('welcome back').closest('.overflow-y-auto') as HTMLDivElement
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    })
    fireEvent.scroll(scroller)
    rerender(<LogWindow log={logOf({ messages: [createChatMessage('assistant', 'new conversation')] })} conversation="second" />)
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 1000 })
  })
})
