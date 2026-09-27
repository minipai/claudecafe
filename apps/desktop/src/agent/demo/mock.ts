import type { AgentMessage, QueryOptions, Todo } from '../types'
import {
  ABOUT_ANSWER,
  ABOUT_INTRO,
  FACE_PARADE,
  FACE_PARADE_CLOSE,
  EDIT_DENIED_LINE,
  EDIT_REQUEST,
  HEAVY_DENIED_LINE,
  HEAVY_THOUGHTS,
  HEAVY_DONE_LINE,
  HEAVY_INTRO,
  HEAVY_WHISPERS,
  TODO_STEPS,
} from './content.mock'

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

/** The agent changes the sprite's expression by calling a custom tool —
 * mirrors a `tool()`-registered set_expression in the real SDK. */
function setExpression(expression: string): AgentMessage {
  return { type: 'tool_use', id: `mock-${mockCall++}`, name: 'set_expression', label: '', input: { expression } }
}

/** The mock has no real calls to number, but the scene keys results off the id. */
let mockCall = 0

/** The demos that are about her rather than about the work. */
function isAbout(prompt: string) {
  return prompt.includes('What can you do')
}

function isFaceParade(prompt: string) {
  return prompt.includes('Show me all your faces')
}

/** The mock hands over the whole list at once; `done` is how many steps are finished. */
function todosAt(done: number): Todo[] {
  return TODO_STEPS.map((content, index) => ({
    content,
    status: index < done ? 'completed' : index === done ? 'in_progress' : 'pending',
  }))
}

/** Mock stand-in for @anthropic-ai/claude-agent-sdk's `query()` — same async-generator shape. */
export async function* query({
  prompt,
  abortController,
  canUseTool,
}: QueryOptions): AsyncGenerator<AgentMessage> {
  const signal = abortController?.signal
  yield { type: 'system', subtype: 'init' }

  // Compaction is asked for the same way as in the real SDK: by sending /compact
  // as a prompt. The only thing that comes back is the boundary marker.
  if (prompt.trim() === '/compact') {
    await sleep(900, signal)
    if (signal?.aborted) return
    yield { type: 'system', subtype: 'compact_boundary' }
    return
  }

  yield setExpression('focused')

  // Asked about herself: no work to do, so no tools and no waiting — she just
  // answers, which is its own demonstration of the short path.
  if (isAbout(prompt)) {
    yield { type: 'text_delta', text: ABOUT_INTRO }
    await sleep(700, signal)
    if (signal?.aborted) return
    yield setExpression('proud')
    yield { type: 'result', tier: 'medium', line: ABOUT_ANSWER }
    return
  }

  // The parade: the face is the model's to choose turn by turn, and saying so
  // is nothing next to watching it happen line by line.
  if (isFaceParade(prompt)) {
    for (const face of FACE_PARADE) {
      await sleep(950, signal)
      if (signal?.aborted) return
      yield setExpression(face.expression)
      yield { type: 'text_delta', text: face.line }
    }
    await sleep(950, signal)
    if (signal?.aborted) return
    yield setExpression('happy')
    yield { type: 'result', tier: 'light', line: FACE_PARADE_CLOSE }
    return
  }

  // The bug hunt: she works on her own, thinking aloud with a task list, and
  // stops to ask before she changes anything.
  yield { type: 'text_delta', text: HEAVY_INTRO }
  yield { type: 'todos', todos: todosAt(0) }

  let elapsed = 0
  let thoughtIndex = 0
  let stoppedEarly: string | null = null
  for (const [index, whisper] of HEAVY_WHISPERS.entries()) {
    // Reasoning surfaces while the work runs, not in a batch at the end.
    while (thoughtIndex < HEAVY_THOUGHTS.length && HEAVY_THOUGHTS[thoughtIndex].delay <= whisper.delay) {
      const thought = HEAVY_THOUGHTS[thoughtIndex++]
      await sleep(thought.delay - elapsed, signal)
      if (signal?.aborted) return
      elapsed = thought.delay
      yield { type: 'thinking', text: thought.text }
    }

    await sleep(whisper.delay - elapsed, signal)
    if (signal?.aborted) return
    elapsed = whisper.delay

    if (whisper.name === 'Bash' && canUseTool) {
      // Writing the fix needs a yes of its own — the UI shows the diff.
      const edit = await canUseTool('Edit', EDIT_REQUEST)
      if (signal?.aborted) return
      if (edit.behavior === 'deny') {
        stoppedEarly = EDIT_DENIED_LINE
        break
      }
      yield { type: 'todos', todos: todosAt(2) }

      const tests = await canUseTool('Bash', {
        command: 'pnpm test',
        description: 'Run the session-pool benchmark',
      })
      if (signal?.aborted) return
      if (tests.behavior === 'deny') {
        stoppedEarly = HEAVY_DENIED_LINE
        break
      }
    }

    yield { type: 'tool_use', id: `mock-${mockCall++}`, name: whisper.name, label: whisper.label }
    yield { type: 'todos', todos: todosAt(index + 1) }
  }

  if (stoppedEarly) {
    yield { type: 'result', tier: 'heavy', line: stoppedEarly }
    return
  }

  await sleep(3600 - elapsed, signal)
  if (signal?.aborted) return
  yield { type: 'todos', todos: todosAt(TODO_STEPS.length) }
  yield setExpression('happy')
  yield { type: 'result', tier: 'heavy', line: HEAVY_DONE_LINE }
}
