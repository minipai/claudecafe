import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SDKControlGetUsageResponse, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { Attachment, Question } from '../src/agent/types'
import type { BridgeEvent } from '../src/agent/bridge'

// A fake of just the corner of the SDK MaidSession actually calls — a
// controllable message stream plus the handful of control-channel methods it
// awaits on open(). Real machinery stays out of a unit test.
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  createSdkMcpServer: vi.fn(() => ({})),
  tool: vi.fn(() => ({})),
}))

// She would otherwise read real files under the plugin and ask a real model
// to write her lines — neither of which a unit test should be doing.
vi.mock('./lines', () => ({
  askForLines: vi.fn(),
  knownLines: vi.fn(),
  personaOf: vi.fn(),
  replyLanguage: vi.fn(),
}))

vi.mock('./look', () => ({
  watchLook: vi.fn(() => () => {}),
}))

// She would otherwise write to and read from the master's real notes under
// ~/.claude — the conversation this window is on, its folder history, what
// language it speaks. A unit test gets none of that; every conversation is
// invented per test instead.
vi.mock('./history', () => ({
  rememberSession: vi.fn(),
  forgetSession: vi.fn(),
  lastConversation: vi.fn(),
  conversationBacklog: vi.fn(),
  listConversations: vi.fn(),
  chosenSpeech: vi.fn(),
}))

// The status line otherwise spawns a real `git` in whatever folder the test
// happens to hand it — never what a unit test should be doing either.
vi.mock('./status', () => ({
  readGit: vi.fn(),
}))

import { contextTokens, MaidSession, nameOf, PromptQueue, readUsage, readWindows, whyStopped } from './maid'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { askForLines, knownLines, personaOf, replyLanguage } from './lines'
import { chosenSpeech, conversationBacklog, forgetSession, lastConversation, listConversations, rememberSession } from './history'
import { readGit } from './status'

/** A clean slate for every test, whether or not it cares — a MaidSession test
 * that forgets to configure one of these should get an obviously-wrong
 * default (English, no persona, nobody home) rather than another test's. */
beforeEach(() => {
  vi.mocked(query).mockReset()
  vi.mocked(askForLines).mockReset().mockResolvedValue(null)
  vi.mocked(knownLines).mockReset().mockReturnValue(null)
  vi.mocked(personaOf).mockReset().mockReturnValue('')
  vi.mocked(replyLanguage).mockReset().mockReturnValue('English')
  vi.mocked(rememberSession).mockReset()
  vi.mocked(forgetSession).mockReset()
  vi.mocked(lastConversation).mockReset().mockReturnValue(null)
  vi.mocked(conversationBacklog).mockReset().mockReturnValue(null)
  vi.mocked(listConversations).mockReset().mockReturnValue([])
  vi.mocked(chosenSpeech).mockReset().mockReturnValue('')
  vi.mocked(readGit).mockReset().mockResolvedValue({})
})

describe('whyStopped', () => {
  it('reads a sign-in problem out of a CLI auth error', () => {
    expect(whyStopped('You are not authenticated. Please run `claude login`.')).toBe('sign-in')
    expect(whyStopped('Invalid API key · please run /login')).toBe('sign-in')
    expect(whyStopped('401 Unauthorized')).toBe('sign-in')
  })

  it('reads a limit problem out of a usage/rate-limit error', () => {
    expect(whyStopped('Usage limit reached for this billing period.')).toBe('limit')
    expect(whyStopped('Rate limit exceeded, please try again later.')).toBe('limit')
    expect(whyStopped('Your credit balance is too low to access the Anthropic API.')).toBe('limit')
  })

  it('reads an offline problem out of a network error', () => {
    expect(whyStopped('getaddrinfo ENOTFOUND api.anthropic.com')).toBe('offline')
    expect(whyStopped('fetch failed')).toBe('offline')
    expect(whyStopped('connect ECONNREFUSED 127.0.0.1:443')).toBe('offline')
  })

  it('gives up nothing on an error that is not his to fix elsewhere', () => {
    expect(whyStopped('Something else entirely broke.')).toBeNull()
    expect(whyStopped('Unexpected token < in JSON at position 0')).toBeNull()
  })
})

describe('readWindows', () => {
  it('lists the session and week windows before per-model ones, dropping unmeasured ones', () => {
    const limits: SDKControlGetUsageResponse['rate_limits'] = {
      five_hour: { utilization: 10, resets_at: 'r1' },
      seven_day: { utilization: null, resets_at: 'r2' },
      model_scoped: [
        { display_name: 'Opus', utilization: 5, resets_at: 'r3' },
        { display_name: 'Sonnet', utilization: null, resets_at: 'r4' },
      ],
    } as unknown as SDKControlGetUsageResponse['rate_limits']
    expect(readWindows(limits)).toEqual([
      { label: 'Session', percent: 10, resetsAt: 'r1' },
      { label: 'This week · Opus', percent: 5, resetsAt: 'r3' },
    ])
  })

  it('is empty when there are no limits at all', () => {
    expect(readWindows(null as unknown as SDKControlGetUsageResponse['rate_limits'])).toEqual([])
  })
})

describe('readUsage', () => {
  const session = {
    total_cost_usd: 1.5,
    total_lines_added: 20,
    total_lines_removed: 4,
  }

  it('maps the week behaviours through the label table, keeping unknown keys as-is', () => {
    const report = {
      session,
      rate_limits: null,
      behaviors: {
        week: {
          request_count: 30,
          session_count: 3,
          behaviors: [
            { key: 'cache_miss', pct: 12 },
            { key: 'some_future_key', pct: 1 },
          ],
          skills: [{ name: 'skill-a', pct: 4 }],
          agents: [{ name: 'agent-a', pct: 6 }],
        },
      },
    } as unknown as SDKControlGetUsageResponse
    expect(readUsage(report)).toEqual({
      cost: 1.5,
      linesAdded: 20,
      linesRemoved: 4,
      windows: [],
      week: {
        requests: 30,
        sessions: 3,
        behaviours: [
          { label: 'Sessions running 8+ hours', pct: 12 },
          { label: 'some_future_key', pct: 1 },
        ],
        skills: [{ name: 'skill-a', pct: 4 }],
        agents: [{ name: 'agent-a', pct: 6 }],
      },
    })
  })

  it('leaves week null when the account has no plan behaviours to report', () => {
    const report = { session, rate_limits: null, behaviors: undefined } as unknown as SDKControlGetUsageResponse
    expect(readUsage(report).week).toBeNull()
  })
})

describe('contextTokens', () => {
  it('sums input, cache-read and cache-creation tokens', () => {
    expect(contextTokens({ input_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: 3 })).toBe(10)
  })

  it('treats missing or null fields as zero', () => {
    expect(contextTokens({})).toBe(0)
    expect(contextTokens({ input_tokens: undefined, cache_read_input_tokens: null, cache_creation_input_tokens: null })).toBe(0)
  })
})

describe('PromptQueue', () => {
  it('yields a prompt pushed before iteration starts, as a plain string', async () => {
    const queue = new PromptQueue()
    queue.push('hello')
    const iterator = queue[Symbol.asyncIterator]()
    const { value } = await iterator.next()
    expect(value).toEqual({ type: 'user', message: { role: 'user', content: 'hello' }, parent_tool_use_id: null })
  })

  it('yields a prompt pushed only after iteration is already waiting on it', async () => {
    const queue = new PromptQueue()
    const iterator = queue[Symbol.asyncIterator]()
    const pending = iterator.next()
    queue.push('later')
    const { value } = await pending
    expect(value).toEqual({ type: 'user', message: { role: 'user', content: 'later' }, parent_tool_use_id: null })
  })

  it('puts image blocks ahead of the text block when a prompt has pictures', async () => {
    const queue = new PromptQueue()
    const images: Attachment[] = [{ mediaType: 'image/png', data: 'AAAA' }]
    queue.push('look at this', images)
    const iterator = queue[Symbol.asyncIterator]()
    const { value } = await iterator.next()
    expect(value).toEqual({
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
          { type: 'text', text: 'look at this' },
        ],
      },
      parent_tool_use_id: null,
    })
  })

  it('keeps multiple queued prompts in push order', async () => {
    const queue = new PromptQueue()
    queue.push('first')
    queue.push('second')
    const iterator = queue[Symbol.asyncIterator]()
    const one = await iterator.next()
    const two = await iterator.next()
    expect((one.value as { message: { content: string } }).message.content).toBe('first')
    expect((two.value as { message: { content: string } }).message.content).toBe('second')
  })

  it('drops everything queued but not yet read', async () => {
    const queue = new PromptQueue()
    queue.push('will be dropped')
    queue.clear()
    queue.push('the only one left')
    const iterator = queue[Symbol.asyncIterator]()
    const { value } = await iterator.next()
    expect((value as { message: { content: string } }).message.content).toBe('the only one left')
  })

  it('wakes only the most recently parked reader, not every reader ever parked on it', async () => {
    // A dying connection's reader can still be parked here when a fresh one
    // starts reading the same instance — `reopen()` swaps in a brand new
    // PromptQueue for exactly that reason, but this pins the fallback: `wake`
    // is one slot, last writer wins, not a list everyone parked gets called
    // back on. Turn it into an array of callbacks and this starts failing.
    const queue = new PromptQueue()
    const stale = queue[Symbol.asyncIterator]()
    const staleParked = stale.next()

    const fresh = queue[Symbol.asyncIterator]()
    const freshParked = fresh.next()

    queue.push('for the fresh reader')

    const { value } = await freshParked
    expect((value as { message: { content: string } }).message.content).toBe('for the fresh reader')

    const race = await Promise.race([
      staleParked.then(() => 'woke'),
      new Promise<string>((resolve) => setTimeout(() => resolve('still parked'), 20)),
    ])
    expect(race).toBe('still parked')
  })
})

/** Just enough of a live SDK connection for MaidSession to talk to: a message
 * stream the test feeds by hand, and the handful of control-channel calls
 * `open()` makes and awaits before a turn ever starts.
 *
 * `prompt` is read eagerly, in a loop that never stops pulling — the same
 * thing the real SDK does the instant something lands in the queue it was
 * handed. A fake that only sat there and let a test inspect the queue's own
 * innards is exactly how the hold-back bug hid: nothing ever actually drained
 * it, so a queue with two prompts sitting in it looked no different from one
 * with a single prompt sent and a second genuinely held back. */
function fakeStream(prompt: AsyncIterable<SDKUserMessage>) {
  const queued: SDKMessage[] = []
  let wake: (() => void) | null = null
  let ended = false
  let failure: Error | null = null

  async function* messages(): AsyncGenerator<SDKMessage, void> {
    for (;;) {
      if (queued.length) {
        yield queued.shift()!
        continue
      }
      if (failure) throw failure
      if (ended) return
      await new Promise<void>((resolve) => (wake = resolve))
    }
  }
  const iterator = messages()

  const interrupt = vi.fn(async () => undefined)
  const returned = vi.fn(async () => {
    ended = true
    wake?.()
    wake = null
    return { value: undefined, done: true as const }
  })

  const raw = {
    [Symbol.asyncIterator]: () => iterator,
    interrupt,
    setPermissionMode: vi.fn(async () => undefined),
    setModel: vi.fn(async () => undefined),
    return: returned,
    initializationResult: vi.fn(async () => ({ account: {}, commands: [], agents: [], output_style: 'default' })),
    supportedModels: vi.fn(async () => []),
    supportedCommands: vi.fn(async () => []),
    supportedAgents: vi.fn(async () => []),
    mcpServerStatus: vi.fn(async () => []),
    getContextUsage: vi.fn(async () => null),
    usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET: vi.fn(async () => ({})),
  }

  // What actually reached "the CLI's stdin", in the order it reached it —
  // the plain text of every prompt this connection was ever handed.
  const sent: string[] = []
  void (async () => {
    for await (const said of prompt) {
      const content = (said as { message: { content: unknown } }).message.content
      sent.push(typeof content === 'string' ? content : JSON.stringify(content))
    }
  })()

  return {
    stream: raw as unknown as ReturnType<typeof query>,
    sent,
    push: (message: SDKMessage) => {
      queued.push(message)
      wake?.()
      wake = null
    },
    /** The connection itself dies mid-stream — a dropped network, a CLI that
     * exited. The next pull throws, same as the real thing. */
    fail: (error: Error) => {
      failure = error
      wake?.()
      wake = null
    },
    interrupt,
    returned,
  }
}

function assistantText(text: string): SDKMessage {
  return {
    type: 'assistant',
    message: { model: 'claude', content: [{ type: 'text', text }], usage: {} },
    parent_tool_use_id: null,
    uuid: 'u',
    session_id: 's',
  } as unknown as SDKMessage
}

function resultMessage(text = 'done'): SDKMessage {
  return { type: 'result', subtype: 'success', result: text, usage: {}, uuid: 'u', session_id: 's' } as unknown as SDKMessage
}

function collectEvents() {
  const events: BridgeEvent[] = []
  return { events, emit: (event: BridgeEvent) => events.push(event) }
}

type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<{ behavior: 'allow' | 'deny'; message?: string }>

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

/** Wires the mocked `query` to open a fresh fake connection every time
 * `open()`/`reopen()` calls it, each one eagerly draining whatever prompt
 * queue it was handed — same as the real SDK. */
function trackConnections() {
  const fakes: ReturnType<typeof fakeStream>[] = []
  vi.mocked(query).mockImplementation((args) => {
    const fake = fakeStream(args.prompt as AsyncIterable<SDKUserMessage>)
    fakes.push(fake)
    return fake.stream
  })
  return fakes
}

describe('MaidSession — reopen closes out an in-flight run (finding #1)', () => {
  it('tells the run it is done, and does not let the next one answer under its id', async () => {
    const fakes = trackConnections()

    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-reopen', emit)

    session.ask('run-1', 'first prompt')
    await vi.waitFor(() => expect(fakes).toHaveLength(1))

    fakes[0].push(assistantText('working on it'))
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'message' && e.runId === 'run-1')).toBe(true))

    // A setting that only takes effect on a fresh connection, mid-run.
    session.configure({ effort: 'low' })
    expect(events).toContainEqual({ kind: 'done', runId: 'run-1' })

    session.ask('run-2', 'second prompt')
    await vi.waitFor(() => expect(fakes).toHaveLength(2))

    const before = events.length
    fakes[1].push(assistantText('back again'))
    await vi.waitFor(() => expect(events.length).toBeGreaterThan(before))

    const after = events.slice(before).filter((e) => e.kind === 'message')
    expect(after.length).toBeGreaterThan(0)
    expect(after.every((e) => e.kind === 'message' && e.runId === 'run-2')).toBe(true)
  })
})

describe('MaidSession — prompts are held back until nothing is in flight (bug 1)', () => {
  it('attributes each turn on one connection to its own run, sending the second prompt only once the first is done', async () => {
    const fakes = trackConnections()

    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-holdback', emit)

    session.ask('run-1', 'first')
    await vi.waitFor(() => expect(fakes[0]?.sent).toEqual(['first']))

    // Queued behind a turn still running — it must sit in this process, not
    // already be on its way to the CLI's stdin.
    session.ask('run-2', 'second')
    expect(fakes).toHaveLength(1) // same connection — nothing here reopens it

    fakes[0].push(assistantText('working on the first one'))
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'message' && e.runId === 'run-1')).toBe(true))
    expect(events.some((e) => e.kind === 'message' && e.runId === 'run-2')).toBe(false)
    // By now plenty of async ticks have gone by (the wait above polled for
    // one) — proof this is a real hold-back, not just a check that landed
    // before the eager consumer got around to it.
    expect(fakes[0].sent).toEqual(['first'])

    fakes[0].push(resultMessage())
    await vi.waitFor(() => expect(events).toContainEqual({ kind: 'done', runId: 'run-1' }))

    // Only now does the second prompt actually reach the CLI.
    await vi.waitFor(() => expect(fakes[0].sent).toEqual(['first', 'second']))

    fakes[0].push(assistantText('now the second'))
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'message' && e.runId === 'run-2')).toBe(true))

    fakes[0].push(resultMessage())
    await vi.waitFor(() => expect(events).toContainEqual({ kind: 'done', runId: 'run-2' }))
  })

  it('discards a prompt queued behind an interrupted turn before it ever reaches the CLI', async () => {
    const fakes = trackConnections()

    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-holdback-stop', emit)

    session.ask('run-1', 'first')
    await vi.waitFor(() => expect(fakes[0]?.sent).toEqual(['first']))
    session.ask('run-2', 'queued behind it')

    // The danger this is pinning is exactly this gap: real time passing
    // between the queued ask and the stop, during which the real SDK (and
    // this fake, honestly) would already have drained anything actually
    // sitting in the queue. A held-back prompt must survive this either way.
    await new Promise((resolve) => setTimeout(resolve, 0))

    session.interrupt()

    // Give the eager consumer every further chance to prove it wrong: ask
    // for a real run behind the stop and wait on its own message. The
    // interrupted turn's own result drifts back first — the CLI processes
    // turns strictly in order, so it has to finish (or abort) run-1 before
    // it can even start run-3.
    session.ask('run-3', 'after the stop')
    fakes[0].push(resultMessage('aborted'))
    fakes[0].push(assistantText('back to it'))
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'message' && e.runId === 'run-3')).toBe(true))

    expect(fakes[0].sent).toEqual(['first', 'after the stop']) // 'queued behind it' never made it
  })
})

describe('MaidSession — interrupt (finding #2)', () => {
  it('closes out every run at once — the running one may never get a result to end on', async () => {
    const fakes = trackConnections()

    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-interrupt-a', emit)

    session.ask('run-1', 'first')
    await vi.waitFor(() => expect(fakes).toHaveLength(1))
    session.ask('run-2', 'queued behind it')

    session.interrupt()

    expect(fakes[0].interrupt).toHaveBeenCalledTimes(1)
    expect(events).toContainEqual({ kind: 'done', runId: 'run-1' })
    expect(events).toContainEqual({ kind: 'done', runId: 'run-2' })

    // A result drifting back for the stopped turn finds no run open and
    // passes through — it must not close out a turn that never started. A
    // bare sleep-then-assert would pass even on a broken pump() that never
    // got around to reading the push at all, so proof it was actually
    // consumed is required first: ask for a real run behind it and wait on
    // that run's own message, which cannot arrive without the dead result
    // having been read and swallowed ahead of it.
    const settled = events.length
    fakes[0].push(resultMessage('all done'))
    session.ask('run-3', 'after the stop')
    fakes[0].push(assistantText('back to it'))
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'message' && e.runId === 'run-3')).toBe(true))
    expect(events.slice(settled).filter((e) => e.kind === 'done')).toEqual([])
  })

  it('resolves an in-flight permission ask with a deny instead of leaving it parked', async () => {
    const fakes = trackConnections()

    const { emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-interrupt-b', emit)

    session.ask('run-1', 'first')
    await vi.waitFor(() => expect(fakes).toHaveLength(1))

    const options = vi.mocked(query).mock.calls[0][0].options as unknown as { canUseTool: CanUseTool }
    const decision = options.canUseTool('Bash', { command: 'rm -rf /' })

    session.interrupt()

    await expect(decision).resolves.toMatchObject({ behavior: 'deny' })
  })
})

describe('MaidSession — tellLines language race (finding #3)', () => {
  it('discards a reply written for a language nobody wants any more, and asks again for the current one', async () => {
    trackConnections()

    const japanese = { greeting: 'ja', interrupted: 'ja', commandAsk: 'ja', editAsk: 'ja', planAsk: 'ja', errorTitle: 'ja', waiting: ['ja'] }
    const korean = { greeting: 'ko', interrupted: 'ko', commandAsk: 'ko', editAsk: 'ko', planAsk: 'ko', errorTitle: 'ko', waiting: ['ko'] }

    vi.mocked(replyLanguage).mockReturnValue('Japanese')
    const asked = deferred<typeof japanese>()
    vi.mocked(askForLines).mockImplementationOnce(() => asked.promise)

    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-lines', emit)
    session.speakIn() // starts the Japanese trip; it has not come back yet

    await vi.waitFor(() => expect(askForLines).toHaveBeenCalledTimes(1))

    // Told to switch again before that trip came back.
    vi.mocked(replyLanguage).mockReturnValue('Korean')
    vi.mocked(askForLines).mockImplementationOnce(async () => korean)

    asked.resolve(japanese)

    await vi.waitFor(() => expect(askForLines).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'lines')).toBe(true))

    expect(askForLines).toHaveBeenNthCalledWith(1, 'Japanese', '')
    expect(askForLines).toHaveBeenNthCalledWith(2, 'Korean', '')
    expect(events.filter((e) => e.kind === 'lines')).toEqual([{ kind: 'lines', lines: korean }])
  })
})

describe('MaidSession — stream identity guard in pump (bug 3)', () => {
  it('does not act on a message that arrives from a connection already replaced by a reopen', async () => {
    const fakes = trackConnections()

    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-stale-stream', emit)

    session.ask('run-1', 'first')
    await vi.waitFor(() => expect(fakes).toHaveLength(1))

    // A message is already on its way back from the connection the instant
    // it is replaced — `push` queues it, but pump() has not read it yet.
    fakes[0].push(assistantText('from a connection about to be replaced'))
    session.configure({ effort: 'low' }) // `this.stream` goes null synchronously, before that queued message is ever read

    session.ask('run-2', 'second') // the next ask() is what actually reopens the connection — `this.runs[0]` is now run-2's
    await vi.waitFor(() => expect(fakes).toHaveLength(2))

    fakes[1].push(assistantText('from the connection that replaced it'))
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'message' && e.runId === 'run-2')).toBe(true))
    await vi.waitFor(() => expect(fakes[1].sent).toEqual(['second'])) // the new connection's own consumption has caught up

    // Without the guard, the stale message — read against `this.runs[0]`,
    // which by then is run-2's — would show up here too, a second and
    // unwanted message under run-2's id rather than the one meant for it.
    expect(events.filter((e) => e.kind === 'message' && e.runId === 'run-2')).toHaveLength(1)
  })
})

describe('MaidSession — AskUserQuestion round trip', () => {
  it('asks one question at a time and hands the tool its own input back with the picked labels folded in', async () => {
    trackConnections()

    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-askuser', emit)

    session.ask('run-1', 'what should we do')
    const options = vi.mocked(query).mock.calls[0][0].options as unknown as {
      canUseTool: (
        toolName: string,
        input: Record<string, unknown>,
      ) => Promise<{ behavior: 'allow' | 'deny'; updatedInput?: Record<string, unknown> }>
    }

    const questions: Question[] = [
      { header: 'Path', question: 'Which way?', options: [{ label: 'Left' }, { label: 'Right' }], multiSelect: false },
      { header: 'Color', question: 'Which colour?', options: [{ label: 'Red' }, { label: 'Blue' }], multiSelect: true },
    ]
    const input = { questions }
    const decision = options.canUseTool('AskUserQuestion', input)

    // The second question is only asked once the first is answered — a
    // board asking both at once would show the master something to pick
    // from before he has even seen what the first one was for.
    await vi.waitFor(() => expect(events.filter((e) => e.kind === 'ask-question')).toHaveLength(1))
    const first = events.find((e): e is Extract<BridgeEvent, { kind: 'ask-question' }> => e.kind === 'ask-question')!
    expect(first.question).toEqual(questions[0])
    session.answer(first.askId, ['Left'])

    await vi.waitFor(() => expect(events.filter((e) => e.kind === 'ask-question')).toHaveLength(2))
    const second = events.filter((e): e is Extract<BridgeEvent, { kind: 'ask-question' }> => e.kind === 'ask-question')[1]
    expect(second.question).toEqual(questions[1])
    expect(second.askId).not.toBe(first.askId)
    session.answer(second.askId, ['Red', 'Blue'])

    await expect(decision).resolves.toEqual({
      behavior: 'allow',
      updatedInput: {
        ...input,
        answers: {
          'Which way?': 'Left',
          'Which colour?': 'Red, Blue',
        },
      },
    })
  })
})

describe('MaidSession — trouble paths', () => {
  it('raises trouble when the session never reports in within the way-in window', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(query).mockImplementation((args) => {
        const fake = fakeStream(args.prompt as AsyncIterable<SDKUserMessage>)
        fake.stream.initializationResult = vi.fn(() => new Promise<never>(() => {})) // never answers
        return fake.stream
      })

      const { events, emit } = collectEvents()
      const session = new MaidSession('/tmp/cafe-maid-test-wayin', emit)
      session.ask('run-1', 'hello')

      await vi.advanceTimersByTimeAsync(15_000)

      expect(events).toContainEqual({
        kind: 'trouble',
        trouble: { reason: 'sign-in', detail: 'The session did not report in within 15s.' },
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats the connection itself dying mid-run as trouble, closing every run without a duplicate per-run error', async () => {
    const fakes = trackConnections()

    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-offline', emit)

    session.ask('run-1', 'first')
    await vi.waitFor(() => expect(fakes).toHaveLength(1))

    const options = vi.mocked(query).mock.calls[0][0].options as unknown as { canUseTool: CanUseTool }
    const parked = options.canUseTool('Bash', { command: 'ls' }) // proves `waiting` gets resolved too

    fakes[0].fail(new Error('fetch failed'))

    await vi.waitFor(() =>
      expect(events).toContainEqual({ kind: 'trouble', trouble: { reason: 'offline', detail: 'fetch failed' } }),
    )
    expect(events).toContainEqual({ kind: 'done', runId: 'run-1' }) // no `error` riding alongside the trouble
    await expect(parked).resolves.toMatchObject({ behavior: 'deny' })
  })

  it('carries an unrecognized error on the run itself instead of raising trouble for it', async () => {
    const fakes = trackConnections()

    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-unknown-error', emit)

    session.ask('run-1', 'first')
    await vi.waitFor(() => expect(fakes).toHaveLength(1))

    fakes[0].fail(new Error('something exploded'))

    await vi.waitFor(() => expect(events).toContainEqual({ kind: 'done', runId: 'run-1', error: 'something exploded' }))
    // `checkWayIn()` always says something about the door once it connects —
    // what must not happen is a *second*, unrecognized-reason trouble caused
    // by this error, on top of the ordinary "she's in" one it already sent.
    expect(events.some((e) => e.kind === 'trouble' && e.trouble !== null)).toBe(false)
  })
})

describe('MaidSession — resume/reset/refresh', () => {
  it('does nothing when asked to resume the conversation it is already on', () => {
    trackConnections()
    const { emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-resume-same', emit)

    session.resume('conv-a')
    vi.mocked(conversationBacklog).mockClear()
    session.resume('conv-a')

    expect(conversationBacklog).not.toHaveBeenCalled()
  })

  it('closes out whatever was running before switching to a different conversation', async () => {
    const fakes = trackConnections()
    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-resume-switch', emit)

    session.ask('run-1', 'hi')
    await vi.waitFor(() => expect(fakes).toHaveLength(1))

    session.resume('conv-b')

    expect(events).toContainEqual({ kind: 'done', runId: 'run-1' })
  })

  it('emits the backlog for the conversation switched to, and remembers it', () => {
    trackConnections()
    vi.mocked(conversationBacklog).mockReturnValue([{ role: 'user', content: 'hi', at: 1 }])
    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-resume-backlog', emit)

    session.resume('conv-c')

    expect(events).toContainEqual({ kind: 'backlog', sessionId: 'conv-c', lines: [{ role: 'user', content: 'hi', at: 1 }] })
    expect(rememberSession).toHaveBeenCalledWith('/tmp/cafe-maid-test-resume-backlog', 'conv-c')
  })

  it('throws the conversation away on reset, forgetting it and clearing the backlog', () => {
    trackConnections()
    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-reset', emit)

    session.reset()

    expect(events).toContainEqual({ kind: 'backlog', sessionId: null, lines: [] })
    expect(forgetSession).toHaveBeenCalledWith('/tmp/cafe-maid-test-reset')
  })

  it('emits the backlog on refresh even when there is nothing to show', () => {
    trackConnections()
    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-refresh-empty', emit)

    session.refresh()

    expect(events).toContainEqual({ kind: 'backlog', sessionId: null, lines: [] })
  })

  it('closes out a run left parked on a permission ask when the page reloads (bug 5)', async () => {
    const fakes = trackConnections()
    const { events, emit } = collectEvents()
    const session = new MaidSession('/tmp/cafe-maid-test-refresh-wedge', emit)

    session.ask('run-1', 'hi')
    await vi.waitFor(() => expect(fakes).toHaveLength(1))

    const options = vi.mocked(query).mock.calls[0][0].options as unknown as { canUseTool: CanUseTool }
    const parked = options.canUseTool('Bash', { command: 'ls' })

    session.refresh()

    expect(events).toContainEqual({ kind: 'done', runId: 'run-1' })
    await expect(parked).resolves.toMatchObject({ behavior: 'deny' })
  })
})

describe('nameOf', () => {
  // The shape supportedModels() actually returns: the default row and an alias
  // row sharing one resolvedModel, plus rows that stand for themselves.
  const rows = [
    { value: 'default', displayName: 'Default (recommended)', resolvedModel: 'claude-opus-5[1m]' },
    { value: 'opus[1m]', displayName: 'Opus (1M context)', resolvedModel: 'claude-opus-5[1m]' },
    { value: 'sonnet', displayName: 'Sonnet', resolvedModel: 'claude-sonnet-5' },
  ] as Parameters<typeof nameOf>[1]

  it('names the default after the model it resolves to', () => {
    expect(nameOf(rows[0], rows)).toBe('Opus (1M context) (default)')
  })

  it('leaves the named rows as they are', () => {
    expect(nameOf(rows[1], rows)).toBe('Opus (1M context)')
    expect(nameOf(rows[2], rows)).toBe('Sonnet')
  })

  it('keeps the label it was given when nothing else resolves the same', () => {
    const alone = [{ value: 'default', displayName: 'Default (recommended)', resolvedModel: 'claude-opus-5' }] as Parameters<typeof nameOf>[1]
    expect(nameOf(alone[0], alone)).toBe('Default (recommended)')
  })
})
