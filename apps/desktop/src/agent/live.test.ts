import { afterEach, describe, expect, it, vi } from 'vitest'
import { Inbox, query } from './live'
import type { BridgeEvent, CafeBridge } from './bridge'

function createBridge() {
  const listeners = new Set<(event: BridgeEvent) => void>()
  const bridge = {
    start: vi.fn(),
    answer: vi.fn(),
    interrupt: vi.fn(),
    newSession: vi.fn(),
    refresh: vi.fn(),
    listen: vi.fn((onEvent: (event: BridgeEvent) => void) => {
      listeners.add(onEvent)
      return () => listeners.delete(onEvent)
    }),
  } as unknown as CafeBridge
  return {
    bridge,
    emit: (event: BridgeEvent) => listeners.forEach((listen) => listen(event)),
    listenerCount: () => listeners.size,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as { window?: unknown }).window
})

describe('Inbox', () => {
  it('yields pushed items in order', async () => {
    const inbox = new Inbox<number>()
    inbox.push(1)
    inbox.push(2)
    inbox.close()
    const items: number[] = []
    for await (const item of inbox) items.push(item)
    expect(items).toEqual([1, 2])
  })

  it('waits for a push before yielding, then closes cleanly with none given', async () => {
    const inbox = new Inbox<number>()
    const iter = inbox[Symbol.asyncIterator]()
    const pending = iter.next()
    inbox.push(42)
    expect(await pending).toEqual({ value: 42, done: false })
    inbox.close()
    expect(await iter.next()).toEqual({ value: undefined, done: true })
  })

  it('throws once closed with an error, after anything already queued', async () => {
    const inbox = new Inbox<number>()
    inbox.push(1)
    inbox.close('it broke')
    const iter = inbox[Symbol.asyncIterator]()
    expect(await iter.next()).toEqual({ value: 1, done: false })
    await expect(iter.next()).rejects.toThrow('it broke')
  })
})

describe('query', () => {
  it('ignores messages for other run ids and yields its own in order', async () => {
    const { bridge, emit } = createBridge()
    ;(globalThis as { window?: unknown }).window = { cafe: bridge }

    const iter = query({ prompt: 'hi' })
    const first = iter.next()
    const runId = vi.mocked(bridge.start).mock.calls[0][0] as string

    emit({ kind: 'message', runId: 'someone-elses-run', message: { type: 'thinking', text: 'not for us' } })
    emit({ kind: 'message', runId, message: { type: 'thinking', text: 'first' } })
    emit({ kind: 'message', runId, message: { type: 'thinking', text: 'second' } })

    expect(await first).toEqual({ value: { type: 'thinking', text: 'first' }, done: false })
    expect(await iter.next()).toEqual({ value: { type: 'thinking', text: 'second' }, done: false })
  })

  it('closes the generator once the run reports done', async () => {
    const { bridge, emit } = createBridge()
    ;(globalThis as { window?: unknown }).window = { cafe: bridge }

    const iter = query({ prompt: 'hi' })
    const first = iter.next()
    const runId = vi.mocked(bridge.start).mock.calls[0][0] as string
    emit({ kind: 'done', runId })

    expect(await first).toEqual({ value: undefined, done: true })
  })

  it('throws when the run reports done with an error', async () => {
    const { bridge, emit } = createBridge()
    ;(globalThis as { window?: unknown }).window = { cafe: bridge }

    const iter = query({ prompt: 'hi' })
    const first = iter.next()
    const runId = vi.mocked(bridge.start).mock.calls[0][0] as string
    emit({ kind: 'done', runId, error: 'the session dropped' })

    await expect(first).rejects.toThrow('the session dropped')
  })

  it('answers an ask-permission through canUseTool and hands the verdict back over the bridge', async () => {
    const { bridge, emit } = createBridge()
    ;(globalThis as { window?: unknown }).window = { cafe: bridge }
    const canUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' })

    const iter = query({ prompt: 'hi', canUseTool })
    iter.next()
    const runId = vi.mocked(bridge.start).mock.calls[0][0] as string
    emit({ kind: 'ask-permission', runId, askId: 'ask-1', toolName: 'Bash', input: { command: 'ls' } })
    await vi.waitFor(() => expect(bridge.answer).toHaveBeenCalled())

    expect(canUseTool).toHaveBeenCalledWith('Bash', { command: 'ls' })
    expect(bridge.answer).toHaveBeenCalledWith('ask-1', { behavior: 'allow' })
  })

  it('denies by default when no canUseTool was given, rather than auto-allowing an unwatched run', async () => {
    const { bridge, emit } = createBridge()
    ;(globalThis as { window?: unknown }).window = { cafe: bridge }

    const iter = query({ prompt: 'hi' })
    iter.next()
    const runId = vi.mocked(bridge.start).mock.calls[0][0] as string
    emit({ kind: 'ask-permission', runId, askId: 'ask-1', toolName: 'Bash', input: {} })
    await vi.waitFor(() => expect(bridge.answer).toHaveBeenCalled())

    expect(bridge.answer).toHaveBeenCalledWith('ask-1', { behavior: 'deny' })
  })

  it('answers an ask-question through askUser', async () => {
    const { bridge, emit } = createBridge()
    ;(globalThis as { window?: unknown }).window = { cafe: bridge }
    const askUser = vi.fn().mockResolvedValue(['picked this'])

    const iter = query({ prompt: 'hi', askUser })
    iter.next()
    const runId = vi.mocked(bridge.start).mock.calls[0][0] as string
    const question = { header: 'h', question: 'q?', options: [], multiSelect: false }
    emit({ kind: 'ask-question', runId, askId: 'ask-2', question })
    await vi.waitFor(() => expect(bridge.answer).toHaveBeenCalled())

    expect(askUser).toHaveBeenCalledWith(question)
    expect(bridge.answer).toHaveBeenCalledWith('ask-2', ['picked this'])
  })

  it('answers with nothing picked when no askUser was given', async () => {
    const { bridge, emit } = createBridge()
    ;(globalThis as { window?: unknown }).window = { cafe: bridge }

    const iter = query({ prompt: 'hi' })
    iter.next()
    const runId = vi.mocked(bridge.start).mock.calls[0][0] as string
    emit({ kind: 'ask-question', runId, askId: 'ask-2', question: { header: 'h', question: 'q?', options: [], multiSelect: false } })
    await vi.waitFor(() => expect(bridge.answer).toHaveBeenCalled())

    expect(bridge.answer).toHaveBeenCalledWith('ask-2', [])
  })

  it('interrupts the whole session and ends the generator when the abort signal fires', async () => {
    const { bridge, listenerCount } = createBridge()
    ;(globalThis as { window?: unknown }).window = { cafe: bridge }
    const abortController = new AbortController()

    const iter = query({ prompt: 'hi', abortController })
    const first = iter.next()
    abortController.abort()

    expect(await first).toEqual({ value: undefined, done: true })
    expect(bridge.interrupt).toHaveBeenCalledWith()
    // The generator has finished, so its listener no longer holds the bridge.
    expect(listenerCount()).toBe(0)
  })

  it('removes its listener once the run is done', async () => {
    const { bridge, emit, listenerCount } = createBridge()
    ;(globalThis as { window?: unknown }).window = { cafe: bridge }

    const iter = query({ prompt: 'hi' })
    const first = iter.next()
    expect(listenerCount()).toBe(1)
    const runId = vi.mocked(bridge.start).mock.calls[0][0] as string
    emit({ kind: 'done', runId })
    await first

    expect(listenerCount()).toBe(0)
  })
})
