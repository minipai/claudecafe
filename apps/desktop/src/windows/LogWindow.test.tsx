// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CafeBridge, SceneShare } from '@/agent/bridge'
import { createChatMessage } from '@/galgame/chatlog'

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
    conversation: null,
    isBusy: false,
    isCompacting: false,
    isAwaitingAnswer: false,
    ...overrides,
  }
}

/** The window reads its bridge once, on import — so it is put in place first. */
async function mount(log: SceneShare['log']) {
  const bridge = { sendToScene: vi.fn() } as unknown as CafeBridge
  ;(window as unknown as { cafe: CafeBridge }).cafe = bridge
  vi.resetModules()
  const { LogWindow } = await import('./LogWindow')
  render(<LogWindow log={log} />)
  return bridge
}

describe('LogWindow', () => {
  it('hides the resume command until the master has spoken in the conversation', async () => {
    await mount(logOf({ conversation: 'fresh-session' }))
    expect(screen.queryByText('claude --resume fresh-session')).not.toBeInTheDocument()
  })

  it('shows the resume command once the conversation has an id and a word from him', async () => {
    await mount(logOf({ conversation: 'session-123', messages: [createChatMessage('user', 'hello')] }))
    expect(screen.getByText('claude --resume session-123')).toBeInTheDocument()
  })

  it('asks the scene to compact, start over, or have him back', async () => {
    const bridge = await mount(logOf({ isAwaitingAnswer: true }))

    await act(async () => screen.getByRole('button', { name: /Compact/ }).click())
    await act(async () => screen.getByRole('button', { name: /New conversation/ }).click())
    await act(async () => screen.getByRole('button', { name: /waiting for an answer/ }).click())

    expect(vi.mocked(bridge.sendToScene).mock.calls).toEqual([
      [{ kind: 'compact' }],
      [{ kind: 'new-session' }],
      [{ kind: 'return' }],
    ])
  })
})
