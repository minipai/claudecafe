import type { AgentMessage, PermissionResult, QueryOptions, Question } from './types'
import type { CafeBridge } from './bridge'

/**
 * The live adapter: same shape as the mock, but every message comes over the
 * bridge from the Electron main process, where the real Agent SDK runs. The
 * SDK's callbacks arrive as asks and are answered by id.
 */
export async function* query(options: QueryOptions): AsyncGenerator<AgentMessage> {
  const bridge = window.cafe as CafeBridge
  const runId = crypto.randomUUID()
  const inbox = new Inbox<AgentMessage>()

  const stopListening = bridge.listen((event) => {
    // Only these belong to a run; the rest is the window's own business.
    if (event.kind === 'status' || event.kind === 'look' || event.kind === 'backlog') return
    if (event.kind === 'commands') return
    if (event.kind === 'settings' || event.runId !== runId) return
    switch (event.kind) {
      case 'message':
        inbox.push(event.message)
        break
      case 'ask-permission':
        void answerPermission(bridge, event.askId, options, event.toolName, event.input)
        break
      case 'ask-question':
        void answerQuestion(bridge, event.askId, options, event.question)
        break
      case 'done':
        inbox.close(event.error)
        break
    }
  })

  const abort = () => bridge.interrupt(runId)
  options.abortController?.signal.addEventListener('abort', abort, { once: true })

  try {
    bridge.start(runId, options.prompt, options.images ?? [])
    yield* inbox
  } finally {
    stopListening()
    options.abortController?.signal.removeEventListener('abort', abort)
  }
}

async function answerPermission(
  bridge: CafeBridge,
  askId: string,
  options: QueryOptions,
  toolName: string,
  input: Record<string, unknown>,
) {
  const decision: PermissionResult = options.canUseTool
    ? await options.canUseTool(toolName, input)
    : { behavior: 'allow' }
  bridge.answer(askId, decision)
}

async function answerQuestion(
  bridge: CafeBridge,
  askId: string,
  options: QueryOptions,
  question: Question,
) {
  bridge.answer(askId, options.askUser ? await options.askUser(question) : [])
}

/** Tell the main process to drop the conversation; the next prompt opens a fresh one. */
export function newSession() {
  window.cafe?.newSession()
}

/** A push-to-pull queue: the bridge pushes, the generator pulls. */
class Inbox<T> {
  private queued: T[] = []
  private wake: (() => void) | null = null
  private closed = false
  private failure: string | undefined

  push(item: T) {
    this.queued.push(item)
    this.release()
  }

  close(error?: string) {
    this.closed = true
    this.failure = error
    this.release()
  }

  private release() {
    this.wake?.()
    this.wake = null
  }

  async *[Symbol.asyncIterator]() {
    for (;;) {
      while (this.queued.length) yield this.queued.shift() as T
      if (this.closed) {
        if (this.failure) throw new Error(this.failure)
        return
      }
      await new Promise<void>((resolve) => (this.wake = resolve))
    }
  }
}
