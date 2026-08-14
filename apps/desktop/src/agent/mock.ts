import type { AgentMessage, QueryOptions, Tier, Todo } from './types'
import {
  CHOICE_QUESTION,
  EXTRAS_QUESTION,
  HEAVY_THOUGHTS,
  choiceAckLine,
  EDIT_DENIED_LINE,
  EDIT_REQUEST,
  FAILURE_MESSAGE,
  HEAVY_DENIED_LINE,
  HEAVY_DONE_LINE,
  HEAVY_INTRO,
  HEAVY_REPORT,
  HEAVY_WHISPERS,
  LOOK_BY_TIER,
  LOOK_HEAVY_WORKING,
  MEDIUM_ANSWER,
  MEDIUM_INTRO,
  PLAN_APPROVED_LINE,
  PLAN_INTRO,
  PLAN_MD,
  PLAN_REJECTED_LINE,
  SHORT_ANSWER,
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

/** Demo buttons pass their own label as the prompt, so the mock can pin the tier instead of rolling one. */
const TIER_HINTS: Record<string, Tier> = {
  'Ask a quick question': 'light',
  'Explain this code': 'medium',
  'Investigate a bug': 'heavy',
}

/** The agent changes the sprite's expression by calling a custom tool —
 * mirrors a `tool()`-registered set_expression in the real SDK. */
function setExpression(expression: string): AgentMessage {
  return { type: 'tool_use', id: `mock-${mockCall++}`, name: 'set_expression', label: '', input: { expression } }
}

/** The mock has no real calls to number, but the scene keys results off the id. */
let mockCall = 0

/** The plan demo pins plan mode; a real client sets permissionMode: 'plan' instead. */
function isPlanned(prompt: string) {
  return prompt.includes('Plan the fix')
}

/** The failure demo — stands in for a dropped connection or a refused request. */
function shouldFail(prompt: string) {
  return prompt.includes('Simulate a failure')
}

/** The mock hands over the whole list at once; `done` is how many steps are finished. */
function todosAt(done: number): Todo[] {
  return TODO_STEPS.map((content, index) => ({
    content,
    status: index < done ? 'completed' : index === done ? 'in_progress' : 'pending',
  }))
}

function pickTier(prompt: string): Tier {
  for (const [hint, tier] of Object.entries(TIER_HINTS)) {
    if (prompt.includes(hint)) return tier
  }
  const tiers: Tier[] = ['light', 'medium', 'heavy']
  return tiers[Math.floor(Math.random() * tiers.length)]
}

/** Mock stand-in for @anthropic-ai/claude-agent-sdk's `query()` — same async-generator shape. */
export async function* query({
  prompt,
  abortController,
  canUseTool,
  askUser,
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

  const tier = isPlanned(prompt) ? 'heavy' : pickTier(prompt)
  yield setExpression('focused')

  if (shouldFail(prompt)) {
    await sleep(700, signal)
    if (signal?.aborted) return
    throw new Error(FAILURE_MESSAGE)
  }

  if (tier === 'light') {
    await sleep(380, signal)
    if (signal?.aborted) return
    yield setExpression('happy')
    yield { type: 'result', tier, line: SHORT_ANSWER }
    yield { type: 'look', look: LOOK_BY_TIER.light }
    return
  }


  if (tier === 'medium') {
    yield { type: 'text_delta', text: MEDIUM_INTRO }
    await sleep(1000, signal)
    if (signal?.aborted) return
    yield setExpression('happy')
    yield { type: 'result', tier, line: MEDIUM_ANSWER }
    yield { type: 'look', look: LOOK_BY_TIER.medium }
    return
  }

  // heavy
  // Plan mode: the model hands over a written plan through ExitPlanMode and
  // waits for a yes before it is allowed to touch anything.
  if (isPlanned(prompt) && canUseTool) {
    yield { type: 'text_delta', text: PLAN_INTRO }
    await sleep(600, signal)
    if (signal?.aborted) return
    const verdict = await canUseTool('ExitPlanMode', { plan: PLAN_MD })
    if (signal?.aborted) return
    if (verdict.behavior === 'deny') {
      yield { type: 'result', tier: 'light', line: PLAN_REJECTED_LINE }
      return
    }
    yield { type: 'text_delta', text: PLAN_APPROVED_LINE }
    await sleep(400, signal)
    if (signal?.aborted) return
  } else {
    yield { type: 'text_delta', text: HEAVY_INTRO }
  }

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

    if (whisper.name === 'Bash' && askUser) {
      // AskUserQuestion: the model hands the player a question and waits.
      const picked = await askUser(CHOICE_QUESTION)
      if (signal?.aborted) return
      const extras = await askUser(EXTRAS_QUESTION)
      if (signal?.aborted) return
      yield { type: 'text_delta', text: choiceAckLine([...picked, ...extras]) }
      await sleep(500, signal)
      if (signal?.aborted) return
    }

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
    // A look reshot mid-run — the real adapter shoots one after each piece of work.
    if (whisper === HEAVY_WHISPERS[1]) {
      yield { type: 'look', look: LOOK_HEAVY_WORKING }
    }
  }

  if (stoppedEarly) {
    yield { type: 'result', tier, line: stoppedEarly, report: HEAVY_REPORT }
    yield { type: 'look', look: LOOK_HEAVY_WORKING }
    return
  }

  await sleep(3600 - elapsed, signal)
  if (signal?.aborted) return
  yield { type: 'todos', todos: todosAt(TODO_STEPS.length) }
  yield setExpression('happy')
  yield { type: 'result', tier, line: HEAVY_DONE_LINE, report: HEAVY_REPORT }
  yield { type: 'look', look: LOOK_BY_TIER.heavy }
}
