import { randomUUID } from 'node:crypto'
import type { Options, Query, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { REPORT_TOOL } from '../electron/tools'

/**
 * Stands in for the real Agent SDK at e2e bundle time (`build.mjs --fake-sdk`
 * aliases `@anthropic-ai/claude-agent-sdk` to this file) — the window must
 * never reach the real Claude while its own tests are driving it. `query`
 * reads what MaidSession sends and answers a small, fixed script; every other
 * control-channel call it awaits on the way answers with just enough to open.
 *
 * The prompt side is read the way the real SDK reads it: eagerly, and
 * decoupled from whatever turn happens to be running. A fake that instead
 * awaited a turn's own answer before asking the prompt iterable for the next
 * line would never let a second prompt reach the model while the first one
 * is still working — which is exactly the shape of bug this build exists to
 * catch (see conversationQuery below).
 */

// This file only ever ends up in the e2e main process, never the real app —
// so a mistake in the script itself should fail the run on stderr, where
// Playwright's report shows it, rather than pop an unattended modal dialog on
// whoever's desktop the suite happens to be running on.
process.on('uncaughtException', (error) => {
  console.error('[e2e main] uncaught:', error)
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  console.error('[e2e main] unhandled rejection:', reason)
})

export function createSdkMcpServer(): object {
  return {}
}

export function tool(): object {
  return {}
}

export function query({ prompt, options }: { prompt: string | AsyncIterable<SDKUserMessage>; options?: Options }): Query {
  return typeof prompt === 'string' ? linesQuery() : conversationQuery(prompt, options)
}

/** The control-channel answers MaidSession awaits before a turn ever starts —
 * the same on every connection, live or scripted. */
function controlChannel() {
  return {
    setPermissionMode: async () => undefined,
    setModel: async () => undefined,
    initializationResult: async () => initResult(),
    supportedModels: async () => [],
    supportedCommands: async () => [],
    supportedAgents: async () => [],
    mcpServerStatus: async () => [],
    getContextUsage: async () => contextUsage(),
    usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET: async () => usageReport(),
  }
}

/** electron/lines.ts's askForLines path: a single string prompt, answered
 * with prose that has no JSON object in it — readAnswer finds nothing to
 * parse, and the window keeps its built-in English lines. */
function linesQuery(): Query {
  async function* read(): AsyncGenerator<SDKMessage, void> {
    yield result('Nothing written today — the café is closed.', 'e2e-lines')
  }
  const iterator = read()
  return {
    [Symbol.asyncIterator]: () => iterator,
    ...controlChannel(),
    interrupt: async () => undefined,
    return: async () => ({ value: undefined, done: true as const }),
  } as unknown as Query
}

/** The maid.ts / MaidSession path: streaming input, driven by whatever the
 * window pushes into its PromptQueue.
 *
 * Two loops, matching the real SDK's own split rather than the window's:
 * `drainPrompts` reads `promptIter` to exhaustion the moment anything is on
 * it, whatever else is going on; `turns` works through what that leaves
 * behind one prompt at a time, in order. A prompt sent while a turn is still
 * running is picked up by the first loop straight away — it is only the
 * second loop that makes it wait its turn. */
function conversationQuery(promptIter: AsyncIterable<SDKUserMessage>, options: Options | undefined): Query {
  const sessionId = `e2e-${randomUUID().slice(0, 8)}`
  /** What the window is still owed. A plain SDKMessage is read out as one;
   * `explode` is a message that was never real — read() throws instead of
   * yielding it, the same as a dropped connection would mid-turn. */
  const queued: (SDKMessage | { explode: string })[] = []
  let wake: (() => void) | null = null
  let ended = false
  /** Set only while a "slow" turn is off working — interrupt() resolves it
   * early and the turn ends with no result, the same as a real one stopped
   * mid-tool. */
  let cutShort: (() => void) | null = null

  function push(message: SDKMessage) {
    queued.push(message)
    wake?.()
    wake = null
  }

  /** Ends the turn the way a dropped connection would: the message already
   * queued ahead of it is still read first, then this is read in its place. */
  function explode(message: string) {
    queued.push({ explode: message })
    wake?.()
    wake = null
  }

  async function* read(): AsyncGenerator<SDKMessage, void> {
    for (;;) {
      if (queued.length) {
        const next = queued.shift()!
        if ('explode' in next) throw new Error(next.explode)
        yield next
        continue
      }
      if (ended) return
      await new Promise<void>((resolve) => (wake = resolve))
    }
  }
  const iterator = read()

  /** What `turns` has not gotten to yet — filled by `drainPrompts` as fast as
   * the window sends, never by `turns` itself. */
  const pending: string[] = []
  let promptWake: (() => void) | null = null

  /** Fire-and-forget, exactly like the real SDK at query() time: whatever the
   * window pushes is read off `promptIter` the moment it is pushed, whether
   * or not a turn is still running. */
  async function drainPrompts() {
    for await (const said of promptIter) {
      pending.push(promptText(said))
      promptWake?.()
      promptWake = null
    }
  }
  void drainPrompts()

  /** Sequential, unlike the loop above: one prompt answered at a time, in the
   * order it arrived — the SDK's own internal queue, standing in for the CLI
   * process actually doing the work. */
  async function turns() {
    push({ type: 'system', subtype: 'init', session_id: sessionId, uuid: randomUUID() } as unknown as SDKMessage)
    for (;;) {
      if (pending.length === 0) {
        await new Promise<void>((resolve) => (promptWake = resolve))
        continue
      }
      await answer(pending.shift()!)
    }
  }
  void turns()

  async function answer(said: string) {
    if (said.includes('ask permission')) return askPermission()
    if (said.includes('ask a question')) return askQuestion()
    if (said.includes('write report')) return writeReport()
    if (said.includes('go offline')) return goOffline()
    if (said.includes('slow')) return workSlowly()
    return echo(said)
  }

  async function askPermission() {
    const id = toolId()
    const decision = await options?.canUseTool?.(
      'Bash',
      { command: 'echo hello', description: 'Say hello' },
      { signal: new AbortController().signal, toolUseID: id, requestId: id },
    )
    if (decision?.behavior === 'allow') {
      push(assistantToolUse(id, 'Bash', { command: 'echo hello', description: 'Say hello' }, sessionId))
      push(toolResult(id, 'hello', sessionId))
      push(assistantText('Done, the command ran ♪', sessionId))
      push(result('Done, the command ran ♪', sessionId))
    } else {
      push(assistantText('Mm, I will leave it be then~', sessionId))
      push(result('Mm, I will leave it be then~', sessionId))
    }
  }

  /** AskUserQuestion: one question, two options, answered through the same
   * canUseTool round-trip a permission ask takes — MaidSession's `decide`
   * always allows this tool and hands the picked labels back on
   * `updatedInput.answers`, keyed by the question text. */
  async function askQuestion() {
    const id = toolId()
    const question = {
      header: 'Preference',
      question: 'Coffee or tea, Goshujin-sama?',
      options: [{ label: 'Coffee' }, { label: 'Tea' }],
      multiSelect: false,
    }
    const decision = await options?.canUseTool?.(
      'AskUserQuestion',
      { questions: [question] },
      { signal: new AbortController().signal, toolUseID: id, requestId: id },
    )
    const updated = (decision as { updatedInput?: { answers?: Record<string, string> } } | undefined)?.updatedInput
    const picked = updated?.answers?.[question.question] ?? ''
    push(assistantToolUse(id, 'AskUserQuestion', { questions: [question] }, sessionId))
    push(toolResult(id, JSON.stringify({ answers: updated?.answers ?? {} }), sessionId))
    const text = `Noted — ${picked}, then ♪ 【 開心 (˶ˆᗜˆ˵) 】`
    push(assistantText(text, sessionId))
    push(result(text, sessionId))
  }

  async function writeReport() {
    const id = toolId()
    const line = 'Here — I wrote the whole thing up for you.'
    push(assistantToolUse(id, REPORT_TOOL, { line, label: 'Read the report →', body: '# Report\n\nSome **markdown** body.' }, sessionId))
    push(toolResult(id, 'Report delivered — the master can open it from the scene.', sessionId))
    push(result(line, sessionId))
  }

  async function workSlowly() {
    push(assistantText('Let me see…', sessionId))
    push(assistantText('Still working on it…', sessionId))
    const interrupted = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        cutShort = null
        resolve(false)
      }, 10_000)
      cutShort = () => {
        clearTimeout(timer)
        cutShort = null
        resolve(true)
      }
    })
    if (interrupted) {
      // The real CLI still owes a result for the turn it just abandoned, and
      // pays up right after the interrupt receipt — MaidSession counts on
      // swallowing exactly that one before trusting attribution again.
      push(result('Interrupted by user', sessionId))
      return
    }
    push(result('All done, that took a moment ♪', sessionId))
  }

  /** The message stream itself drops mid-turn — the trouble path, not a
   * refused tool. One line goes out first, so there is something on screen
   * for `whyStopped`'s panel to be replacing. */
  async function goOffline() {
    push(assistantText('Hmm, that is odd — let me check something…', sessionId))
    explode('fetch failed')
  }

  async function echo(said: string) {
    const text = `Echo: ${said} 【 開心 (˶ˆᗜˆ˵) 】`
    push(assistantText(text, sessionId))
    push(result(text, sessionId))
  }

  return {
    [Symbol.asyncIterator]: () => iterator,
    ...controlChannel(),
    interrupt: async () => {
      cutShort?.()
      return undefined
    },
    return: async () => {
      ended = true
      wake?.()
      wake = null
      return { value: undefined, done: true as const }
    },
  } as unknown as Query
}

/** The text half of a prompt — a plain string, or the text block behind the
 * pictures when one was handed over with an image. */
function promptText(message: SDKUserMessage): string {
  const content = message.message.content
  if (typeof content === 'string') return content
  const block = (content as { type?: string; text?: string }[]).find((one) => one.type === 'text')
  return block?.text ?? ''
}

let toolCounter = 0
const toolId = () => `toolu_e2e_${toolCounter++}`

function assistantText(text: string, sessionId: string): SDKMessage {
  return {
    type: 'assistant',
    session_id: sessionId,
    uuid: randomUUID(),
    message: { model: 'fake-model', content: [{ type: 'text', text }], usage: { output_tokens: 5 } },
    parent_tool_use_id: null,
  } as unknown as SDKMessage
}

function assistantToolUse(id: string, name: string, input: Record<string, unknown>, sessionId: string): SDKMessage {
  return {
    type: 'assistant',
    session_id: sessionId,
    uuid: randomUUID(),
    message: { model: 'fake-model', content: [{ type: 'tool_use', id, name, input }], usage: { output_tokens: 0 } },
    parent_tool_use_id: null,
  } as unknown as SDKMessage
}

function toolResult(id: string, text: string, sessionId: string): SDKMessage {
  return {
    type: 'user',
    session_id: sessionId,
    uuid: randomUUID(),
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: text, is_error: false }] },
    parent_tool_use_id: null,
  } as unknown as SDKMessage
}

/**
 * `output_tokens` alone left the window's context figure at zero — the real
 * usage block also carries what the turn read in, live and off the cache,
 * which is what MaidSession actually sums for that figure (see
 * `contextTokens` in electron/maid.ts). 800 + 500 + 200 is picked to land on
 * a round 1.5k once StatusBar compacts it, so a spec can assert the exact text.
 */
function result(text: string, sessionId: string): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    session_id: sessionId,
    uuid: randomUUID(),
    result: text,
    usage: { output_tokens: 5, input_tokens: 800, cache_read_input_tokens: 500, cache_creation_input_tokens: 200 },
  } as unknown as SDKMessage
}

function initResult() {
  return {
    commands: [],
    agents: [],
    output_style: 'default',
    available_output_styles: ['default'],
    models: [],
    account: { email: 'e2e@test', organization: 'Claude Café', subscriptionType: 'max', apiProvider: 'firstParty' },
  }
}

function contextUsage() {
  return { model: 'fake-model', totalTokens: 0, maxTokens: 200_000, percentage: 0, categories: [], memoryFiles: [], mcpTools: [] }
}

function usageReport() {
  return {
    session: { total_cost_usd: 0, total_lines_added: 0, total_lines_removed: 0 },
    subscription_type: 'max',
    rate_limits_available: false,
    rate_limits: null,
    behaviors: undefined,
  }
}
