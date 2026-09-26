// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { speakThis } from '@/i18n'
import { BackdropPicker } from './BackdropPicker'

afterEach(() => {
  cleanup()
  speakThis('en')
})

it('offers the three OpenChan illustrations and no backdrop as one choice', () => {
  speakThis('en')
  const onChoose = vi.fn()
  render(<BackdropPicker chosen="art-nouveau" onChoose={onChoose} />)

  const buttons = ['None', 'Art Nouveau', 'Ukiyo-e', 'Shojo manga'].map((name) => screen.getByRole('button', { name }))
  expect(buttons).toHaveLength(4)
  expect(buttons[1]).toHaveAttribute('aria-pressed', 'true')
  expect(buttons[2]).toHaveAttribute('aria-pressed', 'false')

  fireEvent.submit(buttons[2].closest('form')!)
  expect(onChoose).toHaveBeenCalledWith('ukiyo-e')
})
