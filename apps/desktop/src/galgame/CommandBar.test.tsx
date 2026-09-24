// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { speakThis } from '@/i18n'
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
})

function createDoing() {
  return {
    onNewSession: vi.fn(),
    onChooseMaid: vi.fn(),
    onOpenHistory: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenProjects: vi.fn(),
    onOpenSession: vi.fn(),
    onCompact: vi.fn(),
    mode: 'default' as const,
    modePicked: false,
    onMode: vi.fn(),
  }
}

function renderBar() {
  const onClose = vi.fn()
  const doing = createDoing()
  render(<CommandBar open folder="/tmp/project" doing={doing} onClose={onClose} />)
  return { onClose, doing }
}

describe('CommandBar', () => {
  it('opens the settings window rather than choosing inside the bar', async () => {
    const { doing, onClose } = renderBar()

    await act(async () => {
      screen.getByText('Settings').closest('button')?.click()
    })
    expect(doing.onOpenSettings).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('offers separate commands for a new conversation and choosing another maid', async () => {
    const { doing } = renderBar()

    await act(async () => {
      screen.getByText('Start a new conversation').closest('button')?.click()
    })
    expect(doing.onNewSession).toHaveBeenCalledOnce()
    expect(doing.onChooseMaid).not.toHaveBeenCalled()

    await act(async () => {
      screen.getByText('Choose a maid for a new conversation').closest('button')?.click()
    })
    expect(doing.onChooseMaid).toHaveBeenCalledOnce()
  })

  it('projects: the English wording still finds it under a different locale — a typed shortcut is muscle memory, not translated', async () => {
    speakThis('zh-TW')
    renderBar()

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'proj' } })
    })

    // zh-TW's own label for the entry — found by matching its English one.
    expect(screen.getByText('專案')).toBeInTheDocument()
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

    // Third entry in the commands list — projects, a new conversation, then this one.
    expect(doing.onChooseMaid).toHaveBeenCalledOnce()
  })
})
