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
    if (event.kind === 'commands' || event.kind === 'folder' || event.kind === 'trouble' || event.kind === 'lines' || event.kind === 'locale' || event.kind === 'speech') return
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

  /**
   * Stopped by the master. The session is told, and this run is over here and
   * now rather than when the session gets round to saying so — an interrupt
   * that lands on a running tool ends the turn without a result, so the word
   * that it finished may never come, and a run nobody ever closes leaves the
   * scene believing she is still working long after she has answered.
   */
  const abort = () => {
    bridge.interrupt()
    inbox.close()
  }
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
  // No caller to ask is not a caller who said yes — a run with nothing wired
  // up to answer for it gets the answer that leaves her hands off things,
  // not the one that lets her touch everything unwatched.
  const decision: PermissionResult = options.canUseTool
    ? await options.canUseTool(toolName, input)
    : { behavior: 'deny' }
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
export class Inbox<T> {
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
