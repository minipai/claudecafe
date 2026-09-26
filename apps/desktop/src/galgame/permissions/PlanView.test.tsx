// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanView } from './PlanView'

afterEach(cleanup)

describe('PlanView', () => {
  it('closes on Esc — the panel takes the whole scene and the window has no frame to get out by', () => {
    const onClose = vi.fn()
    render(<PlanView shortline="Here is the plan" plan="# The plan" onClose={onClose} actions={null} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('leaves an Esc something else has already answered alone — the slash list closes on it too', () => {
    const onClose = vi.fn()
    render(<PlanView shortline="Here is the plan" plan="# The plan" onClose={onClose} actions={null} />)

    const taken = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    taken.preventDefault()
    window.dispatchEvent(taken)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('stays put on any other key', () => {
    const onClose = vi.fn()
    render(<PlanView shortline="Here is the plan" plan="# The plan" onClose={onClose} actions={null} />)

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onClose).not.toHaveBeenCalled()
  })
})
