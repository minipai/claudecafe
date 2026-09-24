// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeEvent, CafeBridge, CastMember, SceneShare } from '@/agent/bridge'

const cast: CastMember[] = ['kotone', 'kurumi'].map((id) => ({
  id,
  name: id === 'kotone' ? 'ことね' : 'くるみ',
  avatar: `cafe-character://cast/${id}/avatar.webp`,
  expressions: { neutral: `cafe-character://cast/${id}/portraits/neutral.webp`, happy: `cafe-character://cast/${id}/portraits/happy.webp` },
}))

// jsdom does not implement scrollIntoView, and the command bar calls it to
// keep the highlighted row in view; nor scrollTo, and the log calls it to
// keep the newest line in view.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.scrollTo = vi.fn()
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
    setBackdrop: vi.fn(),
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
    shift: { maid: 'kotone' },
    maidName: 'ことね',
    setShift: vi.fn(),
    cast: vi.fn().mockResolvedValue(cast),
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
    openSideWindow: vi.fn(),
    shareScene: vi.fn(),
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
  render(<GalgameClient cast={cast} directory="/mock/characters" onRefreshCharacters={vi.fn()} />)
  return { bridge, emit }
}

/** What the log and settings windows were last handed. */
function lastShared(bridge: CafeBridge) {
  const calls = vi.mocked(bridge.shareScene).mock.calls
  return calls[calls.length - 1][0] as SceneShare
}

/** Everything the log window was last handed, as said. */
function logged(bridge: CafeBridge) {
  return lastShared(bridge).log.messages.map((message) => message.content)
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

  it('⌘L opens the log window and ⌘, the settings window, beside her rather than over her', async () => {
    const { bridge } = await mountLive()

    await act(async () => fireEvent.keyDown(window, { key: 'l', metaKey: true }))
    await act(async () => fireEvent.keyDown(window, { key: ',', metaKey: true }))

    expect(bridge.openSideWindow).toHaveBeenNthCalledWith(1, 'log')
    expect(bridge.openSideWindow).toHaveBeenNthCalledWith(2, 'settings')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shares the conversation with the log window as it grows', async () => {
    const { bridge, emit } = await mountLive()
    await act(async () => emit({ kind: 'conversation', sessionId: 'fresh-session' }))
    await act(async () => submit('hello'))

    const { conversation, log } = lastShared(bridge)
    expect(conversation).toBe('fresh-session')
    expect(log.messages.map((message) => message.content)).toContain('hello')
  })

  it('does what the side windows ask, the way the scene would do it itself', async () => {
    const { bridge, emit } = await mountLive()

    await act(async () => emit({ kind: 'side-window', action: { kind: 'locale', choice: 'zh-TW' } }))
    await act(async () => emit({ kind: 'side-window', action: { kind: 'speech', language: '日本語' } }))
    await act(async () => emit({ kind: 'side-window', action: { kind: 'backdrop', backdrop: 'ukiyo-e' } }))

    expect(bridge.setLocale).toHaveBeenCalledWith('zh-TW')
    expect(bridge.setSpeech).toHaveBeenCalledWith('日本語')
    expect(bridge.setBackdrop).toHaveBeenCalledWith('ukiyo-e')
    expect(lastShared(bridge).settings.backdrop).toBe('ukiyo-e')
  })

  it('opening a conversation in another folder sends her there first, then back into it', async () => {
    const { bridge, emit } = await mountLive()

    await act(async () =>
      emit({ kind: 'side-window', action: { kind: 'conversation', folder: '/elsewhere', sessionId: 'old-one' } }),
    )

    expect(bridge.switchFolder).toHaveBeenCalledWith('/elsewhere')
    expect(bridge.resume).toHaveBeenCalledWith('old-one')
    expect(vi.mocked(bridge.switchFolder).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(bridge.resume).mock.invocationCallOrder[0],
    )
  })

  it('a conversation in the folder she is already in is only resumed', async () => {
    const { bridge, emit } = await mountLive()

    await act(async () =>
      emit({ kind: 'side-window', action: { kind: 'conversation', folder: '/mock/project', sessionId: 'old-one' } }),
    )

    expect(bridge.switchFolder).not.toHaveBeenCalled()
    expect(bridge.resume).toHaveBeenCalledWith('old-one')
  })

  it('the window answers its own slash commands by opening the window that has them', async () => {
    const { bridge } = await mountLive()

    await act(async () => submit('/context'))
    expect(lastShared(bridge).session.tab).toBe('context')
    await act(async () => submit('/keys'))
    await act(async () => submit('/resume'))

    expect(vi.mocked(bridge.openSideWindow).mock.calls).toEqual([['session'], ['settings'], ['projects']])
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
    await act(async () => emit({ kind: 'side-window', action: { kind: 'browse' } }))

    await act(async () => submit('run the tests once more'))
    runId = lastRunId(bridge)
    await act(async () =>
      emit({ kind: 'ask-permission', runId, askId: 'ask-3', toolName: 'Bash', input: { command: 'git status' } }),
    )

    // Not auto-answered this time — the card is back, waiting on him again.
    expect(screen.getByRole('button', { name: 'Always allow Bash git' })).toBeInTheDocument()
    expect(bridge.answer).not.toHaveBeenCalledWith('ask-3', expect.anything())
  })

  it('Bug 4 — an answer she wrote out keeps its layout while it stands, rather than reflowing when the next thing is asked', async () => {
    const { bridge, emit } = await mountLive()

    await act(async () => submit('what is zh?'))
    const runId = lastRunId(bridge)
    await act(async () =>
      emit({
        kind: 'message',
        runId,
        message: { type: 'result', tier: 'medium', line: 'The short of it.\n\nAnd then the rest of it.' },
      }),
    )

    const written = () => document.querySelector('.report-md')
    await vi.waitFor(() => expect(written()!.querySelectorAll('p')).toHaveLength(2))

    // The master asks the next thing. Her answer stays in the box — faded, but
    // still the shape she wrote it in, not one wall of text.
    await act(async () => submit('and ja?'))
    expect(written()!.querySelectorAll('p')).toHaveLength(2)
  })

  it('plays an unsolicited background completion when no foreground turn is running', async () => {
    const { bridge, emit } = await mountLive()

    await act(async () =>
      emit({
        kind: 'ambient-message',
        message: { type: 'result', tier: 'light', line: 'The background task is done.' },
      }),
    )

    expect(logged(bridge)).toContain('The background task is done.')
  })

  it('defers a background completion until the foreground turn ends, preserving the submitted message', async () => {
    const { bridge, emit } = await mountLive()

    await act(async () => submit('the foreground question'))
    const runId = lastRunId(bridge)
    await act(async () =>
      emit({
        kind: 'ambient-message',
        message: { type: 'result', tier: 'light', line: 'The background task is done.' },
      }),
    )

    expect(logged(bridge)).toContain('the foreground question')
    expect(logged(bridge)).not.toContain('The background task is done.')

    await act(async () => emit({ kind: 'done', runId }))
    await vi.waitFor(() => expect(logged(bridge)).toContain('The background task is done.'))
    expect(logged(bridge)).toContain('the foreground question')
  })

  it('starts a new conversation with the maid already on shift without opening the picker', async () => {
    const { bridge } = await mountLive({ shift: { maid: 'kurumi' } })

    await act(async () => screen.getByLabelText('Open the command bar').click())
    await act(async () => screen.getByText('Start a new conversation').closest('button')!.click())

    expect(bridge.newSession).toHaveBeenCalledOnce()
    expect(bridge.setShift).not.toHaveBeenCalled()
    expect(screen.queryByRole('radio', { name: 'ことね' })).not.toBeInTheDocument()
  })

  it("Bug 5 — handing over the shift greets in the new maid's voice, not whoever stood there before her", async () => {
    const KURUMI = 'ご主人様～♪ くるみ在這裡等你好久了呢！'
    const KOTONE = '歡迎回來，ご主人様。ことね隨時為您效勵喔～'
    const { bridge, emit } = await mountLive({ shift: { maid: 'kurumi' } })

    // くるみ is on shift, and her lines were written in her own voice once.
    await act(async () => emit({ kind: 'lines', lines: linesIn(KURUMI) }))

    // Choosing a maid asks who is taking over; the master picks ことね.
    await act(async () => screen.getByLabelText('Open the command bar').click())
    await act(async () => screen.getByText('Choose a maid for a new conversation').closest('button')!.click())
    await act(async () => screen.getByRole('radio', { name: 'ことね' }).click())
    await act(async () => screen.getByRole('button', { name: 'Start her shift' }).click())

    // The session answers the reset: nothing said yet, then whoever was picked
    // speaking in her own words — both well inside the hand-over pause.
    await act(async () => {
      emit({ kind: 'backlog', sessionId: null, lines: [] })
      emit({ kind: 'lines', lines: linesIn(KOTONE) })
    })

    // Once the pause is over, the log starts with her — not a word of くるみ's.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 500)))
    expect(logged(bridge)).toContain(KOTONE)
    expect(logged(bridge)).not.toContain(KURUMI)
  })
})

function linesIn(greeting: string) {
  return {
    greeting,
    interrupted: 'え、止めるんですか…？',
    commandAsk: 'may I run this?',
    editAsk: 'may I change this file?',
    planAsk: 'does the plan look right?',
    errorTitle: 'oops',
    waiting: ['a', 'b', 'c', 'd', 'e'],
  }
}
