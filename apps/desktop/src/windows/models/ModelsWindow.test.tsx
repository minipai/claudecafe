// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CafeBridge, ModelChoice } from '@/agent/bridge'

afterEach(() => {
  cleanup()
  delete (window as { cafe?: unknown }).cafe
})

describe('ModelsWindow', () => {
  it('filters SDK choices and sends independent model and effort selections to the scene', async () => {
    const bridge = { sendToScene: vi.fn() } as unknown as CafeBridge
    ;(window as unknown as { cafe: CafeBridge }).cafe = bridge
    vi.resetModules()
    const { ModelsWindow } = await import('./ModelsWindow')
    const models: ModelChoice[] = [
      { value: 'sonnet', label: 'Sonnet', efforts: ['low', 'medium', 'high'] },
      { value: 'opus', label: 'Opus', efforts: ['low', 'high', 'max'] },
    ]
    const { rerender } = render(<ModelsWindow
      settings={{ model: 'sonnet', effort: 'medium', mode: 'default', modePicked: false }}
      models={models}
    />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search models' }), { target: { value: 'opus' } })
    expect(screen.queryByRole('button', { name: /Sonnet/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Opus/ }))
    fireEvent.click(screen.getByRole('button', { name: 'high' }))

    expect(bridge.sendToScene).toHaveBeenNthCalledWith(1, { kind: 'model', model: 'opus' })
    expect(bridge.sendToScene).toHaveBeenNthCalledWith(2, { kind: 'effort', effort: 'high' })

    rerender(<ModelsWindow settings={{ model: 'opus', effort: 'max', mode: 'default', modePicked: false }} models={models} />)
    expect(screen.getByRole('button', { name: 'Opus' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'max' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'medium' })).not.toBeInTheDocument()
  })
})
