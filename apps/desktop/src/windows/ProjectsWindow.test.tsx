// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CafeBridge, Conversation } from '@/agent/bridge'

afterEach(() => {
  cleanup()
  delete (window as { cafe?: unknown }).cafe
})

const talks: Record<string, Conversation[]> = {
  '/work/cafe': [{ sessionId: 'here-1', opening: 'split the settings out', at: 1 }],
  '/work/chan': [{ sessionId: 'there-1', opening: 'fix the demo cast', at: 2 }],
}

/** The window reads its bridge once, on import — so it is put in place first. */
async function mount(conversation: string | null = null) {
  const bridge = {
    folders: vi.fn().mockResolvedValue(['/work/chan', '/work/cafe']),
    folderConversations: vi.fn((folder: string) => Promise.resolve(talks[folder] ?? [])),
    sendToScene: vi.fn(),
  } as unknown as CafeBridge
  ;(window as unknown as { cafe: CafeBridge }).cafe = bridge
  vi.resetModules()
  const { ProjectsWindow } = await import('./ProjectsWindow')
  await act(async () => render(<ProjectsWindow folder="/work/cafe" conversation={conversation} />))
  return bridge
}

describe('ProjectsWindow', () => {
  it('opens on the folder she is in, with its conversations', async () => {
    await mount('here-1')

    expect(screen.getAllByRole('button', { pressed: true }).map((row) => row.title)).toEqual([
      '/work/cafe',
      'split the settings out',
    ])
  })

  it('looking into another folder moves nothing; opening a conversation there does', async () => {
    const bridge = await mount()

    await act(async () => screen.getByTitle('/work/chan').click())
    expect(bridge.sendToScene).not.toHaveBeenCalled()

    await act(async () => screen.getByTitle('fix the demo cast').click())
    expect(bridge.sendToScene).toHaveBeenCalledWith({ kind: 'conversation', folder: '/work/chan', sessionId: 'there-1' })
  })

  it('offers to work in a folder only when it is not the one she is in', async () => {
    const bridge = await mount()
    expect(screen.queryByRole('button', { name: 'Work in this folder' })).not.toBeInTheDocument()

    await act(async () => screen.getByTitle('/work/chan').click())
    await act(async () => screen.getByRole('button', { name: 'Work in this folder' }).click())

    expect(bridge.sendToScene).toHaveBeenCalledWith({ kind: 'folder', folder: '/work/chan' })
  })
})
