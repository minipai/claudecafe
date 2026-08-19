import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lines } from '@/agent'
import { speakThis, text } from '@/i18n'
import { applyWindowEvent, type WindowScene } from './windowEvents'
import { createChatMessage } from './chatlog'
import { ENGLISH_LINES, lines as spokenLines, speakThese } from './content'

afterEach(() => {
  // Both are module-level singletons the handler writes through — left as
  // whatever the last test set them to, the next file to read `text()` or
  // `lines()` gets a locale or a wording that was never its own to have.
  speakThis('en')
  speakThese(ENGLISH_LINES)
})

const LINES: Lines = {
  greeting: 'her English greeting',
  interrupted: 'stopped',
  commandAsk: 'may I run this?',
  editAsk: 'may I change this?',
  planAsk: 'does this look right?',
  errorTitle: 'tripped over something',
  waiting: ['a moment~'],
}

function createScene(overrides: Partial<WindowScene> = {}): WindowScene {
  return {
    askingLanguage: { current: false },
    setLook: vi.fn(),
    setLookUnread: vi.fn(),
    setSettings: vi.fn(),
    setModels: vi.fn(),
    setFolder: vi.fn(),
    setCommands: vi.fn(),
    setSpeech: vi.fn(),
    setLocale: vi.fn(),
    setLines: vi.fn(),
    setChatMessages: vi.fn(),
    setTrouble: vi.fn(),
    setPhase: vi.fn(),
    setConversation: vi.fn(),
    setExpression: vi.fn(),
    setReport: vi.fn(),
    setLaidOut: vi.fn(),
    setCtaVisible: vi.fn(),
    resetScene: vi.fn(),
    cut: vi.fn(),
    greetingRef: { current: LINES.greeting },
    linesRef: { current: LINES },
    lastLineRef: { current: LINES.greeting },
    ...overrides,
  }
}

describe('applyWindowEvent', () => {
  it('look: shoots a fresh look and marks it unread', () => {
    const scene = createScene()
    applyWindowEvent({ kind: 'look', look: { scene: 'she looks up', dialogue: 'oh!' } }, scene)
    expect(scene.setLook).toHaveBeenCalledWith({ scene: 'she looks up', dialogue: 'oh!' })
    expect(scene.setLookUnread).toHaveBeenCalledWith(true)
  })

  it('settings: takes the session settings and what models are on offer together', () => {
    const scene = createScene()
    const settings = { model: null, effort: 'high' as const, mode: 'default' as const }
    const models = [{ value: 'opus', label: 'Opus', efforts: ['high' as const] }]
    applyWindowEvent({ kind: 'settings', settings, models }, scene)
    expect(scene.setSettings).toHaveBeenCalledWith(settings)
    expect(scene.setModels).toHaveBeenCalledWith(models)
  })

  it('folder: the window is bound to wherever she was just sent', () => {
    const scene = createScene()
    applyWindowEvent({ kind: 'folder', cwd: '/elsewhere' }, scene)
    expect(scene.setFolder).toHaveBeenCalledWith('/elsewhere')
  })

  it('commands: what / offers, replaced wholesale', () => {
    const scene = createScene()
    const commands = [{ name: '/status', description: 'd', argumentHint: '' }]
    applyWindowEvent({ kind: 'commands', commands }, scene)
    expect(scene.setCommands).toHaveBeenCalledWith(commands)
  })

  it('speech: what she is speaking and what was asked for', () => {
    const scene = createScene()
    applyWindowEvent({ kind: 'speech', language: 'Japanese', chosen: 'Japanese' }, scene)
    expect(scene.setSpeech).toHaveBeenCalledWith({ language: 'Japanese', chosen: 'Japanese' })
  })

  it('locale: keeps the choice, which may be "system", and actually draws the interface in it', () => {
    const scene = createScene()
    applyWindowEvent({ kind: 'locale', locale: 'zh-TW', choice: 'zh-TW' }, scene)
    expect(scene.setLocale).toHaveBeenCalledWith('zh-TW')
    // speakThis is the handler's real job — the setter alone only redraws
    // whatever already reads `text()` fresh; it does not switch the catalogue.
    expect(text().ask.allow).toBe('可以')
  })

  it('lines: swaps the stale English opening for her own wording, when it is still all she has said', () => {
    const scene = createScene()
    const stale = createChatMessage('assistant', LINES.greeting)
    let updater: ((current: ReturnType<typeof createChatMessage>[]) => unknown) | undefined
    scene.setChatMessages = vi.fn((arg) => {
      updater = typeof arg === 'function' ? arg : undefined
    }) as unknown as WindowScene['setChatMessages']

    applyWindowEvent({ kind: 'lines', lines: { ...LINES, greeting: 'her own opening' } }, scene)

    expect(scene.setLines).toHaveBeenCalledWith({ ...LINES, greeting: 'her own opening' })
    expect(scene.greetingRef.current).toBe('her own opening')
    expect(scene.linesRef.current.greeting).toBe('her own opening')
    // speakThese is the handler's real job — the setter alone only redraws
    // whatever already reads `lines()` fresh; it does not change what she says.
    expect(spokenLines().greeting).toBe('her own opening')
    // The stale-swap logic runs inside the setChatMessages updater.
    expect(updater?.([stale])).toEqual([expect.objectContaining({ content: 'her own opening' })])
    // The box is still showing the stale greeting, so it is rewritten in place.
    expect(scene.cut).toHaveBeenCalledWith('her own opening')
  })

  it('lines: leaves the log alone once the conversation has moved past the greeting', () => {
    const scene = createScene({ lastLineRef: { current: 'something said after the greeting' } })
    applyWindowEvent({ kind: 'lines', lines: { ...LINES, greeting: 'her own opening' } }, scene)
    expect(scene.cut).not.toHaveBeenCalled()
  })

  it('trouble: closes the door and stops the plate spinning', () => {
    const scene = createScene()
    applyWindowEvent({ kind: 'trouble', trouble: { reason: 'offline', detail: 'the network dropped' } }, scene)
    expect(scene.setTrouble).toHaveBeenCalledWith({ reason: 'offline', detail: 'the network dropped' })
    expect(scene.setPhase).toHaveBeenCalledWith('idle')
  })

  it('trouble: null opens the door back up without touching the phase', () => {
    const scene = createScene()
    applyWindowEvent({ kind: 'trouble', trouble: null }, scene)
    expect(scene.setTrouble).toHaveBeenCalledWith(null)
    expect(scene.setPhase).not.toHaveBeenCalled()
  })

  it('backlog: an empty history opens up fresh, the way any session starts', () => {
    const scene = createScene()
    applyWindowEvent({ kind: 'backlog', sessionId: 'session-1', lines: [] }, scene)
    expect(scene.setConversation).toHaveBeenCalledWith('session-1')
    expect(scene.setChatMessages).toHaveBeenCalledWith([expect.objectContaining({ content: LINES.greeting })])
    expect(scene.setExpression).toHaveBeenCalledWith('neutral')
    expect(scene.cut).toHaveBeenCalledWith(LINES.greeting)
  })

  it('backlog: resets the scene — the report laid out, the mood signed, and any standing always-allow all belonged to the last place', () => {
    const scene = createScene()
    applyWindowEvent({ kind: 'backlog', sessionId: 'session-1', lines: [] }, scene)
    expect(scene.resetScene).toHaveBeenCalledOnce()
  })

  it('backlog: restores the transcript, and puts her last line and its mood back on the box', () => {
    const scene = createScene()
    applyWindowEvent(
      {
        kind: 'backlog',
        sessionId: 'session-1',
        lines: [
          { role: 'user', content: 'hi', at: 1 },
          { role: 'assistant', content: 'done ♪ 【 開心 (˶ˆᗜˆ˵) 】', at: 2 },
        ],
      },
      scene,
    )
    expect(scene.setChatMessages).toHaveBeenCalledWith([
      expect.objectContaining({ role: 'user', content: 'hi' }),
      expect.objectContaining({ role: 'assistant', content: 'done ♪ 【 開心 (˶ˆᗜˆ˵) 】' }),
    ])
    expect(scene.setExpression).toHaveBeenCalledWith('happy')
    // The marker is worn on her face, not left typed in the box.
    expect(scene.cut).toHaveBeenCalledWith('done ♪')
  })

  it('backlog: the write-up she handed over on her last line comes back with the link that opens it', () => {
    const scene = createScene()
    const report = { label: 'read the write-up →', body: '# What I found\n\nplenty' }
    applyWindowEvent(
      {
        kind: 'backlog',
        sessionId: 'session-1',
        lines: [
          { role: 'assistant', content: 'it is all written down~', at: 1, report },
        ],
      },
      scene,
    )
    expect(scene.setChatMessages).toHaveBeenCalledWith([expect.objectContaining({ report })])
    expect(scene.setReport).toHaveBeenLastCalledWith(report)
    expect(scene.setCtaVisible).toHaveBeenLastCalledWith(true)
  })

  it('backlog: a conversation that ends on a plain line leaves no link under the box', () => {
    const scene = createScene()
    applyWindowEvent(
      { kind: 'backlog', sessionId: 'session-1', lines: [{ role: 'assistant', content: 'nothing to show', at: 1 }] },
      scene,
    )
    expect(scene.setReport).toHaveBeenLastCalledWith(null)
    expect(scene.setCtaVisible).toHaveBeenLastCalledWith(false)
  })

  it('backlog: an answer she wrote out comes back laid out, with its marker off it', () => {
    const scene = createScene()
    applyWindowEvent(
      {
        kind: 'backlog',
        sessionId: 'session-1',
        lines: [
          { role: 'assistant', content: 'first para\n\n- and a list\n\n【 開心 (˶ˆᗜˆ˵) 】', at: 1, laidOut: true },
        ],
      },
      scene,
    )
    expect(scene.setLaidOut).toHaveBeenCalledWith('first para\n\n- and a list')
  })

  it('backlog: a line she simply said comes back as speech, not laid out', () => {
    const scene = createScene()
    applyWindowEvent(
      { kind: 'backlog', sessionId: 'session-1', lines: [{ role: 'assistant', content: 'just words', at: 1 }] },
      scene,
    )
    expect(scene.setLaidOut).not.toHaveBeenCalled()
  })

  it('backlog: leaves her face alone when her last line signed with no mood at all', () => {
    const scene = createScene()
    applyWindowEvent(
      { kind: 'backlog', sessionId: 'session-1', lines: [{ role: 'assistant', content: 'just words', at: 1 }] },
      scene,
    )
    expect(scene.setExpression).not.toHaveBeenCalled()
    expect(scene.cut).toHaveBeenCalledWith('just words')
  })
})
