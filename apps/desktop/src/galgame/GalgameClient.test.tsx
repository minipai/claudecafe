// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeEvent, CafeBridge } from '@/agent/bridge'

// jsdom does not implement scrollIntoView, and the command bar calls it to
// keep the highlighted row in view.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete (window as { cafe?: unknown }).cafe
})

/** Every bridge call the window makes unconditionally on mount, or that the
 * scenarios below drive through — the rest of `CafeBridge` this window never
 * reaches without a folder actually being switched or a panel opened. */
function createBridge() {
  const listeners = new Set<(event: BridgeEvent) => void>()
  const bridge = {
    cwd: '/mock/project',
    locale: 'en',
    localeChoice: 'system',
    askLanguage: vi.fn().mockResolvedValue(false),
    setLocale: vi.fn(),
    setSpeech: vi.fn(),
    start: vi.fn(),
    answer: vi.fn(),
    interrupt: vi.fn(),
    newSession: vi.fn(),
    refresh: vi.fn(),
    configure: vi.fn(),
    signIn: vi.fn(),
    reconnect: vi.fn(),
    usage: vi.fn().mockResolvedValue(null),
    context: vi.fn().mockResolvedValue(null),
    agents: vi.fn().mockResolvedValue([]),
    mcpServers: vi.fn().mockResolvedValue([]),
    status: vi.fn().mockResolvedValue(null),
    persona: vi.fn().mockResolvedValue('# Personality\n\nYou are ことね, an AI maid.'),
    shift: { maid: 'kotone', outfit: 'uniform' },
    maidName: 'ことね',
    setShift: vi.fn(),
    cast: vi.fn().mockResolvedValue([
      { id: 'kotone', name: 'ことね', outfits: [{ id: 'uniform', label: '女僕裝' }] },
      { id: 'kurumi', name: 'くるみ', outfits: [{ id: 'uniform', label: '女僕裝' }] },
    ]),
    conversations: vi.fn().mockResolvedValue([]),
    folders: vi.fn().mockResolvedValue([]),
    switchFolder: vi.fn(),
    resume: vi.fn(),
    openFolder: vi.fn().mockResolvedValue(null),
    notify: vi.fn(),
    clickThrough: vi.fn(),
    followPointer: vi.fn(() => () => {}),
    pathFor: vi.fn(),
    startDrag: vi.fn(),
    endDrag: vi.fn(),
    listen: vi.fn((onEvent: (event: BridgeEvent) => void) => {
      listeners.add(onEvent)
      return () => listeners.delete(onEvent)
    }),
  } as unknown as CafeBridge
  return { bridge, emit: (event: BridgeEvent) => listeners.forEach((listen) => listen(event)) }
}

/**
 * Mounts the window the way it comes up with a real bridge behind it. `isLive`
 * is read once, at the moment `@/agent` is first imported — so the bridge has
 * to be in place before that happens, which means a fresh module graph every
 * time rather than the one the top of this file would otherwise have already
 * settled with no bridge at all.
 */
async function mountLive(bridgeOverrides: Partial<CafeBridge> = {}) {
  const { bridge, emit } = createBridge()
  Object.assign(bridge, bridgeOverrides)
  ;(window as unknown as { cafe: CafeBridge }).cafe = bridge
  vi.resetModules()
  const { GalgameClient } = await import('./GalgameClient')
  render(<GalgameClient />)
  return { bridge, emit }
}

function lastRunId(bridge: CafeBridge) {
  const calls = vi.mocked(bridge.start).mock.calls
  return calls[calls.length - 1][0] as string
}

/** Types a prompt and sends it, the way the master does. */
function submit(said: string) {
  const box = screen.getByPlaceholderText('Say something to ことね…')
  fireEvent.change(box, { target: { value: said } })
  fireEvent.submit(box.closest('form')!)
}

describe('GalgameClient', () => {
  it('Bug 1 — clearSpeech answers a permission ask still queued behind an unread line, instead of leaving it hanging', async () => {
    const { bridge, emit } = await mountLive()

    await act(async () => submit('go fix the thing'))
    const runId = lastRunId(bridge)
    // Something already in the box — the ask that follows has to queue behind it.
    await act(async () => emit({ kind: 'message', runId, message: { type: 'text_delta', text: 'On it~' } }))
    await act(async () =>
      emit({ kind: 'ask-permission', runId, askId: 'ask-1', toolName: 'Bash', input: { command: 'rm -rf dist' } }),
    )

    // The master moving the scene on himself, same as clearSpeech's own doc
    // comment describes — a fresh prompt while the ask is still queued.
    await act(async () => submit('never mind, something else'))

    await vi.waitFor(() => expect(bridge.answer).toHaveBeenCalledWith('ask-1', { behavior: 'deny' }))
  })

  it('Bug 2 — stop clears the queue first, so a permission ask queued behind an unread line is answered rather than left to resurface', async () => {
    const { bridge, emit } = await mountLive()

    await act(async () => submit('go fix the thing'))
    const runId = lastRunId(bridge)
    await act(async () => emit({ kind: 'message', runId, message: { type: 'text_delta', text: 'On it~' } }))
    await act(async () =>
      emit({ kind: 'ask-permission', runId, askId: 'ask-1', toolName: 'Bash', input: { command: 'rm -rf dist' } }),
    )

    await act(async () => screen.getByLabelText('Stop').click())

    await vi.waitFor(() => expect(bridge.answer).toHaveBeenCalledWith('ask-1', { behavior: 'deny' }))
  })

  it('Esc cuts her off while she is working, the same as the stop button', async () => {
    const { bridge } = await mountLive()

    await act(async () => submit('go fix the thing'))
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(bridge.interrupt).toHaveBeenCalled()
  })

  it('Esc leaves a question she is waiting on alone — it is answered in the footer, not by stopping her', async () => {
    const { bridge, emit } = await mountLive()

    await act(async () => submit('run the tests'))
    const runId = lastRunId(bridge)
    await act(async () =>
      emit({ kind: 'ask-permission', runId, askId: 'ask-1', toolName: 'Bash', input: { command: 'git status' } }),
    )

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(bridge.interrupt).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Always allow Bash git' })).toBeInTheDocument()
  })

  it('⌘L opens the log, and closes it again', async () => {
    await mountLive()

    await act(async () => {
      fireEvent.keyDown(window, { key: 'l', metaKey: true })
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await act(async () => {
      fireEvent.keyDown(window, { key: 'l', metaKey: true })
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('/keys is answered by the window itself — the keys are written down somewhere findable', async () => {
    const { bridge } = await mountLive()

    await act(async () => submit('/keys'))

    expect(screen.getByText('Everything said so far')).toBeInTheDocument()
    // Answered here, not sent to her as a prompt.
    expect(bridge.start).not.toHaveBeenCalled()
  })

  it('her name plate opens the persona she is wearing', async () => {
    const { bridge } = await mountLive()

    await act(async () => screen.getByLabelText('Who ことね is').click())

    await vi.waitFor(() => expect(screen.getByText('You are ことね, an AI maid.')).toBeInTheDocument())
    expect(bridge.persona).toHaveBeenCalled()
  })


  it('welcomes a machine nobody has ever set up, and asks for both languages at once', async () => {
    const { bridge } = await mountLive({ askLanguage: vi.fn().mockResolvedValue(true) })

    // Two rows offer 繁體中文: the window's own wording first, what she answers
    // in second. They are separate settings — an English window may well want
    // her speaking something else.
    await vi.waitFor(() => expect(screen.getAllByRole('button', { name: '繁體中文' })).toHaveLength(2))
    const [asTheWindow, asHer] = screen.getAllByRole('button', { name: '繁體中文' })
    await act(async () => asTheWindow.click())
    expect(bridge.setLocale).toHaveBeenCalledWith('zh-TW')

    await act(async () => asHer.click())
    await act(async () => screen.getByRole('button', { name: 'Save settings' }).click())

    expect(bridge.setSpeech).toHaveBeenCalledWith('繁體中文')
    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument()
  })

  it('guesses her language off the machine when he picks none himself', async () => {
    const { bridge } = await mountLive({ askLanguage: vi.fn().mockResolvedValue(true), locale: 'zh-TW' })

    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save settings' })).toBeInTheDocument())
    await act(async () => screen.getByRole('button', { name: 'Save settings' }).click())

    // A Chinese machine, nothing picked: English would be a default nobody
    // asked for.
    expect(bridge.setSpeech).toHaveBeenCalledWith('繁體中文')
  })

  it('takes a language she was written rather than picked', async () => {
    const { bridge } = await mountLive({ askLanguage: vi.fn().mockResolvedValue(true) })

    await vi.waitFor(() =>
      expect(screen.getByLabelText('Something else — write it in any words')).toBeInTheDocument(),
    )
    fireEvent.change(screen.getByLabelText('Something else — write it in any words'), {
      target: { value: 'Español, pero explícame el código en inglés' },
    })
    await act(async () => screen.getByRole('button', { name: 'Save settings' }).click())

    expect(bridge.setSpeech).toHaveBeenCalledWith('Español, pero explícame el código en inglés')
  })

  it('guesses a Japanese machine as 日本語, which is on the shortlist too', async () => {
    const { bridge } = await mountLive({ askLanguage: vi.fn().mockResolvedValue(true), locale: 'ja-JP' })

    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save settings' })).toBeInTheDocument())
    await act(async () => screen.getByRole('button', { name: 'Save settings' }).click())

    expect(bridge.setSpeech).toHaveBeenCalledWith('日本語')
  })

  it('leaves the scene alone when the language was settled long ago', async () => {
    await mountLive()

    expect(screen.queryByRole('button', { name: 'Save settings' })).not.toBeInTheDocument()
  })

  it('Bug 3 — a folder move empties standing always-allows, so the same command re-asks in the new place', async () => {
    const { bridge, emit } = await mountLive()

    // First ask, answered "always allow" — nothing ahead of it in the box, so
    // it shows straight away rather than queuing.
    await act(async () => submit('run the tests'))
    let runId = lastRunId(bridge)
    await act(async () =>
      emit({ kind: 'ask-permission', runId, askId: 'ask-1', toolName: 'Bash', input: { command: 'git status' } }),
    )
    await act(async () => screen.getByRole('button', { name: 'Always allow Bash git' }).click())
    await vi.waitFor(() => expect(bridge.answer).toHaveBeenCalledWith('ask-1', { behavior: 'allow' }))

    // Same standing, same session: covered without asking again.
    await act(async () => submit('run the tests again'))
    runId = lastRunId(bridge)
    await act(async () =>
      emit({ kind: 'ask-permission', runId, askId: 'ask-2', toolName: 'Bash', input: { command: 'git status' } }),
    )
    await vi.waitFor(() => expect(bridge.answer).toHaveBeenCalledWith('ask-2', { behavior: 'allow' }))

    // Sent somewhere else — a standing "yes" from that folder does not follow.
    vi.mocked(bridge.openFolder).mockResolvedValue('/somewhere/else')
    await act(async () => screen.getByLabelText('Open the command bar').click())
    await act(async () => screen.getByText('Work somewhere else').closest('button')!.click())
    await act(async () => screen.getByText('Somewhere not on this list…').closest('button')!.click())

    await act(async () => submit('run the tests once more'))
    runId = lastRunId(bridge)
    await act(async () =>
      emit({ kind: 'ask-permission', runId, askId: 'ask-3', toolName: 'Bash', input: { command: 'git status' } }),
    )

    // Not auto-answered this time — the card is back, waiting on him again.
    expect(screen.getByRole('button', { name: 'Always allow Bash git' })).toBeInTheDocument()
    expect(bridge.answer).not.toHaveBeenCalledWith('ask-3', expect.anything())
  })
})
