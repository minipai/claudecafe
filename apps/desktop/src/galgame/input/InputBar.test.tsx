// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputBar } from './InputBar'
import type { CafeCommand } from '@/agent'

// jsdom does not implement scrollIntoView, and the command menu calls it to
// keep the highlighted row in view.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const commands: CafeCommand[] = [
  // usage-credits deliberately listed before usage: the exactly-typed name
  // must outrank a longer one that happens to arrive first.
  { name: 'usage-credits', description: 'Spell out the bill.', argumentHint: '' },
  { name: 'usage', description: 'Show the meters.', argumentHint: '' },
  { name: 'explain', description: 'Walk the diff.', argumentHint: '[topic]' },
  { name: 'explain-harder', description: 'Walk the diff twice.', argumentHint: '' },
  { name: 'export', description: 'Save the conversation.', argumentHint: '' },
]

function renderBar() {
  const onSubmit = vi.fn()
  render(<InputBar isBusy={false} commands={commands} onSubmit={onSubmit} onStop={() => {}} />)
  return { onSubmit, input: screen.getByRole('textbox') }
}

describe('the slash menu', () => {
  it('completes a half-typed name on Enter instead of sending it', () => {
    const { onSubmit, input } = renderBar()
    fireEvent.change(input, { target: { value: '/ex' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(input).toHaveValue('/explain ')
  })

  it('sends a name typed out in full on Enter — nothing left to complete', () => {
    const { onSubmit, input } = renderBar()
    fireEvent.change(input, { target: { value: '/explain' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('/explain', [])
  })

  it('does not trap him after backspacing the completed space away', () => {
    // Complete, erase the trailing space, press Enter: before the fall-through
    // this re-picked the same command and put the space right back.
    const { onSubmit, input } = renderBar()
    fireEvent.change(input, { target: { value: '/ex' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('/explain ')

    fireEvent.change(input, { target: { value: '/explain' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('/explain', [])
    expect(input).toHaveValue('')
  })

  it('highlights the exactly-typed name over a longer one listed first', () => {
    // `/usage` with `/usage-credits` earlier in the list: Enter must run
    // `/usage`, not complete the neighbour it never asked for.
    const { onSubmit, input } = renderBar()
    fireEvent.change(input, { target: { value: '/usage' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('/usage', [])
  })

  it('still picks an arrowed-to command even when the typed name is complete', () => {
    // `/explain` is a complete name, but the highlight moved to another row:
    // the pick is what he is pointing at, not what he happened to type.
    const { onSubmit, input } = renderBar()
    fireEvent.change(input, { target: { value: '/explain' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(input).toHaveValue('/explain-harder ')
  })

  it('floats over the scene instead of taking part in layout', () => {
    const { input } = renderBar()
    fireEvent.change(input, { target: { value: '/' } })
    expect(screen.getByRole('listbox')).toHaveClass('absolute')
  })
})
