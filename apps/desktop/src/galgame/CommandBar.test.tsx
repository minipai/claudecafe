// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { speakThis } from '@/i18n'
import type { Conversation } from '@/agent'
import { CommandBar } from './CommandBar'

// jsdom does not implement scrollIntoView, and the bar calls it to keep the
// highlighted row in view as the arrow keys move over it.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  speakThis('en')
  delete (window as { cafe?: unknown }).cafe
})

function createDoing() {
  return {
    onNewSession: vi.fn(),
    onOpenHistory: vi.fn(),
    onCompact: vi.fn(),
    onOpenPanel: vi.fn(),
    mode: 'default' as const,
    modePicked: false,
    onMode: vi.fn(),
  }
}

function renderBar(overrides: { conversation?: string | null; openFolder?: () => Promise<string | null> } = {}) {
  const onClose = vi.fn()
  const openFolder = overrides.openFolder ?? vi.fn().mockResolvedValue(null)
  const doing = createDoing()
  const conversations: Conversation[] = [{ sessionId: 'session-1', opening: 'an earlier chat', at: Date.now() }]
  ;(window as unknown as { cafe: unknown }).cafe = {
    folders: vi.fn().mockResolvedValue([]),
    conversations: vi.fn().mockResolvedValue(conversations),
    openFolder,
  }
  render(
    <CommandBar
      open
      folder="/tmp/project"
      conversation={overrides.conversation ?? null}
      locale="en"
      speech={{ language: '', chosen: '' }}
      doing={doing}
      onClose={onClose}
    />,
  )
  return { onClose, openFolder, doing }
}

describe('CommandBar', () => {
  it('browse: waits for the dialog and closes exactly once with the real outcome', async () => {
    let resolvePick: (path: string | null) => void = () => {}
    const openFolder = vi.fn(() => new Promise<string | null>((resolve) => (resolvePick = resolve)))
    const { onClose } = renderBar({ openFolder })

    await act(async () => {
      screen.getByText('Work somewhere else').closest('button')?.click()
    })
    await act(async () => {
      screen.getByText('Somewhere not on this list…').closest('button')?.click()
    })

    // The dialog has not answered yet — the bar has not closed itself out
    // from under it, and there is exactly one call to make once it does.
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => {
      resolvePick('/somewhere/new')
      await Promise.resolve()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it('browse: a cancelled dialog closes once with nothing moved', async () => {
    let resolvePick: (path: string | null) => void = () => {}
    const openFolder = vi.fn(() => new Promise<string | null>((resolve) => (resolvePick = resolve)))
    const { onClose } = renderBar({ openFolder })

    await act(async () => {
      screen.getByText('Work somewhere else').closest('button')?.click()
    })
    await act(async () => {
      screen.getByText('Somewhere not on this list…').closest('button')?.click()
    })
    await act(async () => {
      resolvePick(null)
      await Promise.resolve()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledWith(false)
  })

  it('conversation list: says "here" through the catalogue, not a hardcoded English word', async () => {
    speakThis('zh-TW')
    renderBar({ conversation: 'session-1' })

    await act(async () => {
      screen.getByText('回到之前的對話').closest('button')?.click()
    })

    expect(screen.getByText('目前')).toBeInTheDocument()
    expect(screen.queryByText('here')).not.toBeInTheDocument()
  })

  it('folder: the English wording still finds it under a different locale — a typed shortcut is muscle memory, not translated', async () => {
    speakThis('zh-TW')
    renderBar()

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'work' } })
    })

    // zh-TW's own label for the entry — found by matching its English one.
    expect(screen.getByText('去別的地方工作')).toBeInTheDocument()
  })

  it('ArrowDown moves the highlight off the first entry, and Enter runs whatever is highlighted there', async () => {
    const { doing } = renderBar()
    const box = screen.getByRole('textbox')

    // Each key its own turn through React, the same as a real key press —
    // batched together in one act(), the second ArrowDown and the Enter that
    // follows it would still be reading the highlight from before the first.
    await act(async () => fireEvent.keyDown(box, { key: 'ArrowDown' }))
    await act(async () => fireEvent.keyDown(box, { key: 'ArrowDown' }))
    await act(async () => fireEvent.keyDown(box, { key: 'Enter' }))

    // Third entry in the commands list — folder, resume, then this one.
    expect(doing.onNewSession).toHaveBeenCalledOnce()
  })
})
