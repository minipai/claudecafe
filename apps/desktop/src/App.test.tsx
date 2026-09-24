// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CafeBridge, CastMember } from '@/agent/bridge'
import { speakThis } from '@/i18n'
import { App } from './App'

const { castList, toastError } = vi.hoisted(() => ({ castList: vi.fn(), toastError: vi.fn() }))
vi.mock('@/agent', () => ({ castList }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))
vi.mock('./galgame/GalgameClient', () => ({
  GalgameClient: ({ cast, directory, onRefreshCharacters }: {
    cast: CastMember[]
    directory: string
    onRefreshCharacters: () => Promise<void>
  }) => <div>
    {cast.map((maid) => maid.name).join(', ')}
    <output>{directory}</output>
    <button onClick={() => void onRefreshCharacters()}>Refresh maids</button>
  </div>,
}))

const maid: CastMember = { id: 'custom', name: 'Custom maid', avatar: '/avatar.webp', expressions: { neutral: '/neutral.webp' } }

beforeEach(() => {
  speakThis('en')
  castList.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  delete (window as { cafe?: CafeBridge }).cafe
})

describe('configured character folder', () => {
  it('shows the expected settings path when no maids are installed', async () => {
    window.cafe = { charactersDir: '/settings/claudecafe/characters' } as unknown as CafeBridge
    render(<App />)
    expect(await screen.findByText('Put maid folders in the characters folder beside the café settings. Each maid needs a persona file and portraits/neutral.webp.')).toBeInTheDocument()
    expect(screen.getByText('/settings/claudecafe/characters')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /folder/i })).not.toBeInTheDocument()
  })

  it('loads maids from the settings path and rescans without clearing the scene', async () => {
    castList.mockResolvedValueOnce([maid]).mockResolvedValueOnce([maid, { ...maid, id: 'new', name: 'New maid' }])
    window.cafe = { charactersDir: '/settings/claudecafe/characters' } as unknown as CafeBridge
    render(<App />)
    expect(await screen.findByText('Custom maid')).toBeInTheDocument()
    expect(screen.getByText('/settings/claudecafe/characters')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh maids' }))
    expect(await screen.findByText('Custom maid, New maid')).toBeInTheDocument()
  })

  it('reports a failed character download even when other maids are available', async () => {
    castList.mockResolvedValue([maid])
    window.cafe = { charactersDir: '/settings/claudecafe/characters', characterInstallError: 'kurumi: Download failed' } as unknown as CafeBridge
    render(<App />)
    expect(await screen.findByText('Custom maid')).toBeInTheDocument()
    expect(toastError).toHaveBeenCalledWith('kurumi: Download failed', { id: 'character-install-error' })
  })
})
