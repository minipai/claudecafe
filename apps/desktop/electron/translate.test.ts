import { describe, expect, it } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentMessage } from '../src/agent/types'
import { describeTool, Turn } from './translate'
import { EXPRESSION_TOOL, REPORT_TOOL } from './tools'

const HAPPY = '【 開心 (˶ˆᗜˆ˵) 】'

function textBlock(text: string) {
  return { type: 'text', text }
}

function thinkingBlock(thinking: string) {
  return { type: 'thinking', thinking }
}

function toolUseBlock(id: string, name: string, input: Record<string, unknown> = {}) {
  return { type: 'tool_use', id, name, input }
}

function assistant(content: unknown[], usage?: { output_tokens?: number }, model = 'claude-sonnet') {
  return {
    type: 'assistant',
    message: { model, content, usage },
    parent_tool_use_id: null,
    uuid: 'u1',
    session_id: 's1',
  } as unknown as SDKMessage
}

function toolResult(id: string, content: unknown, isError = false) {
  return {
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] },
    parent_tool_use_id: null,
    uuid: 'u2',
    session_id: 's1',
  } as unknown as SDKMessage
}

function result(text: string, subtype: 'success' | 'error_during_execution' = 'success') {
  return { type: 'result', subtype, result: text, uuid: 'u3', session_id: 's1' } as unknown as SDKMessage
}

function system(sub: Record<string, unknown>) {
  return { type: 'system', uuid: 'u4', session_id: 's1', ...sub } as unknown as SDKMessage
}

function textDeltas(messages: AgentMessage[]) {
  return messages.filter((m) => m.type === 'text_delta')
}

describe('Turn — text blocks', () => {
  it('holds a text block as pendingLine and only speaks it once the next block flushes it', () => {
    const turn = new Turn('hi')
    const out = turn.read(assistant([textBlock('Hello'), textBlock('World')]))
    // "Hello" was flushed by "World" arriving; "World" itself is still held.
    expect(textDeltas(out)).toEqual([{ type: 'text_delta', text: 'Hello', expression: undefined, mood: undefined }])
  })

  it('flushes the held line when a tool_use follows', () => {
    const turn = new Turn('hi')
    const out = turn.read(assistant([textBlock('On it'), toolUseBlock('t1', 'Read', { file_path: 'x.ts' })]))
    expect(textDeltas(out)).toEqual([{ type: 'text_delta', text: 'On it', expression: undefined, mood: undefined }])
  })

  it('flushes the held line as the result when the turn ends', () => {
    const turn = new Turn('hi')
    turn.read(assistant([textBlock('Final answer')]))
    const out = turn.read(result('Final answer'))
    expect(out).toEqual([{ type: 'result', tier: 'light', line: 'Final answer', mood: undefined, expression: undefined, said: false }])
  })
})

describe('Turn — mood markers', () => {
  it('strips the marker from the text and resolves the expression', () => {
    const turn = new Turn('hi')
    const out = turn.read(assistant([textBlock(`So happy~ ${HAPPY}`), toolUseBlock('t1', 'Read', { file_path: 'a' })]))
    expect(textDeltas(out)).toEqual([{ type: 'text_delta', text: 'So happy~', expression: 'happy', mood: HAPPY }])
  })

  it('carries the held ending line\'s own marker and face onto the result', () => {
    const turn = new Turn('hi')
    turn.read(assistant([textBlock(`So happy~ ${HAPPY}`)]))
    const out = turn.read(result(`So happy~ ${HAPPY}`))
    expect(out[0]).toEqual({
      type: 'result',
      tier: 'light',
      line: 'So happy~',
      mood: HAPPY,
      expression: 'happy',
      said: false,
    })
  })

  it('parses the marker, and the face it names, straight off the result text when nothing was held', () => {
    // The line was never streamed as its own text block — she spoke, called a
    // tool, and the marker rode the result instead. The face she signed it
    // with belongs on the result the same as if it had been held.
    const turn = new Turn('hi')
    const out = turn.read(result(`All done~ ${HAPPY}`))
    expect(out[0]).toEqual({
      type: 'result',
      tier: 'light',
      line: 'All done~',
      mood: HAPPY,
      expression: 'happy',
      said: false,
    })
  })

  it('does not carry an earlier, already-said line\'s marker onto a later, unmarked ending', () => {
    const turn = new Turn('hi')
    // She signed the line on the way to a tool call — that marker belongs to
    // that line, said and gone, not to whatever she ends the turn on.
    turn.read(assistant([textBlock(`So happy~ ${HAPPY}`), toolUseBlock('t1', 'Read', { file_path: 'a' })]))
    turn.read(toolResult('t1', 'contents'))
    const out = turn.read(result('Done, no marker this time.'))
    expect(out[0]).toEqual({
      type: 'result',
      tier: 'light',
      line: 'Done, no marker this time.',
      mood: undefined,
      expression: undefined,
      said: false,
    })
  })

  it('signs the line before it when she puts the marker in a block of its own', () => {
    // The cue tells her to sign off on a line of her own, and she sometimes
    // takes that as far as a separate block. The marker still belongs to what
    // she just said, so the line goes out signed rather than bare.
    const turn = new Turn('hi')
    const out = turn.read(assistant([textBlock('All done~'), textBlock(HAPPY), toolUseBlock('t1', 'Read', { file_path: 'a' })]))
    expect(textDeltas(out)).toEqual([{ type: 'text_delta', text: 'All done~', expression: 'happy', mood: HAPPY }])
  })

  it('a plain line with no marker keeps a straight face', () => {
    const turn = new Turn('hi')
    const out = turn.read(assistant([textBlock('No marker here'), toolUseBlock('t1', 'Read', { file_path: 'a' })]))
    expect(textDeltas(out)).toEqual([{ type: 'text_delta', text: 'No marker here', expression: undefined, mood: undefined }])
  })
})

describe('Turn — result tiers', () => {
  it('a short plain answer is light', () => {
    const turn = new Turn('hi')
    const out = turn.read(result('Sure thing.'))
    expect(out).toEqual([{ type: 'result', tier: 'light', line: 'Sure thing.', mood: undefined, expression: undefined, said: false }])
  })

  it('a longer answer with no markdown shape is still light, just because it is long-ish but under the heavy cutoff', () => {
    const turn = new Turn('hi')
    const text = 'a'.repeat(170)
    const out = turn.read(result(text))
    expect(out[0]).toMatchObject({ tier: 'medium' })
  })

  it('exactly 160 characters has no shape yet — hasShape\'s cutoff is strictly greater-than', () => {
    const turn = new Turn('hi')
    const out = turn.read(result('a'.repeat(160)))
    expect(out[0]).toMatchObject({ tier: 'light' })
  })

  it('exactly 1200 characters is still medium, not heavy — isLongForm\'s cutoff is strictly greater-than', () => {
    const turn = new Turn('hi')
    const out = turn.read(result('a'.repeat(1200)))
    expect(out[0]).toMatchObject({ tier: 'medium' })
  })

  it('a list is laid out as medium', () => {
    const turn = new Turn('hi')
    const text = 'Here is what I found:\n- one\n- two\n- three'
    const out = turn.read(result(text))
    expect(out[0]).toMatchObject({ tier: 'medium', line: text })
  })

  it('inline code gives it shape too', () => {
    const turn = new Turn('hi')
    const text = 'Run `pnpm test` to check.'
    const out = turn.read(result(text))
    expect(out[0]).toMatchObject({ tier: 'medium' })
  })

  it('over 1200 characters becomes a heavy report with an opening line', () => {
    const turn = new Turn('hi')
    const text = 'x'.repeat(1300)
    const out = turn.read(result(text))
    expect(out[0]).toMatchObject({
      type: 'result',
      tier: 'heavy',
      report: { label: 'View full report →', body: text },
    })
    expect((out[0] as { line: string }).line.length).toBeLessThanOrEqual(119)
  })

  it('a heading makes it heavy even under the length cutoff', () => {
    const turn = new Turn('hi')
    const text = '# Title\nThe actual first line of substance.'
    const out = turn.read(result(text))
    expect(out[0]).toMatchObject({
      type: 'result',
      tier: 'heavy',
      line: 'The actual first line of substance.',
      report: { label: 'View full report →', body: text },
    })
  })

  it('a code fence makes it heavy too', () => {
    const turn = new Turn('hi')
    const text = 'Here:\n```ts\nconst a = 1\n```'
    const out = turn.read(result(text))
    expect(out[0]).toMatchObject({ tier: 'heavy' })
  })
})

describe('Turn — the error_during_execution subtype', () => {
  it('produces no result message when nothing was held — deliberate, or at least known: readResult only reads sdk.result on success, so an error with no held line ends the turn silently', () => {
    const turn = new Turn('hi')
    const out = turn.read(result('blew up mid-tool-call', 'error_during_execution'))
    expect(out).toEqual([])
  })
})

describe('Turn — said dedup', () => {
  it('marks said:true when the last spoken line before a tool call matches the result', () => {
    const turn = new Turn('hi')
    turn.read(assistant([textBlock('Done!'), toolUseBlock('t1', 'Read', { file_path: 'a' })]))
    turn.read(toolResult('t1', 'file contents'))
    const out = turn.read(result('Done!'))
    expect(out).toEqual([{ type: 'result', tier: 'light', line: 'Done!', mood: undefined, expression: undefined, said: true }])
  })

  it('does not mark said when nothing was spoken beforehand', () => {
    const turn = new Turn('hi')
    const out = turn.read(result('Fresh answer.'))
    expect(out[0]).toMatchObject({ said: false })
  })
})

describe('Turn — the report tool', () => {
  it('hands the body to a heavy result with the given label and line', () => {
    const turn = new Turn('hi')
    turn.read(
      assistant([
        toolUseBlock('t1', REPORT_TOOL, { line: 'Here you go~', label: 'Read the report →', body: '# findings\n\nlots of detail' }),
      ]),
    )
    const out = turn.read(result('whatever she said after'))
    expect(out).toEqual([
      {
        type: 'result',
        tier: 'heavy',
        line: 'Here you go~',
        mood: undefined,
        expression: undefined,
        report: { label: 'Read the report →', body: '# findings\n\nlots of detail' },
      },
    ])
  })

  it('falls back to the default label when she wrote none', () => {
    const turn = new Turn('hi')
    turn.read(assistant([toolUseBlock('t1', REPORT_TOOL, { line: '', label: '', body: 'the body' })]))
    const out = turn.read(result(''))
    expect(out[0]).toMatchObject({ report: { label: 'View full report →' } })
  })

  it('falls back to the opening line of the body when there is no line and no result text', () => {
    const turn = new Turn('hi')
    turn.read(assistant([toolUseBlock('t1', REPORT_TOOL, { line: '', label: 'x', body: '# Title\nThe real opener.' })]))
    const out = turn.read(result(''))
    expect(out[0]).toMatchObject({ line: 'The real opener.' })
  })

  it('marks the report tool_use as silent', () => {
    const turn = new Turn('hi')
    const out = turn.read(assistant([toolUseBlock('t1', REPORT_TOOL, { line: 'a', label: 'b', body: 'c' })]))
    expect(out.find((m) => m.type === 'tool_use')).toMatchObject({ silent: true })
  })
})

describe('Turn — <synthetic> local commands', () => {
  it('labels the printed output with the first word of the prompt', () => {
    const turn = new Turn('/context extra words')
    const out = turn.read(assistant([textBlock('Here is your context usage.')], undefined, '<synthetic>'))
    expect(out).toEqual([{ type: 'command_output', label: '/context', body: 'Here is your context usage.' }])
  })

  it('suppresses the result that follows, since it is the same text coming back round', () => {
    const turn = new Turn('/context')
    turn.read(assistant([textBlock('printed body')], undefined, '<synthetic>'))
    const out = turn.read(result('printed body'))
    expect(out).toEqual([])
  })

  it('produces nothing when the printed body is empty', () => {
    const turn = new Turn('/context')
    const out = turn.read(assistant([], undefined, '<synthetic>'))
    expect(out).toEqual([])
  })
})

describe('Turn — progress', () => {
  it('accumulates output tokens across assistant messages', () => {
    const turn = new Turn('hi')
    const out1 = turn.read(assistant([textBlock('a')], { output_tokens: 10 }))
    const out2 = turn.read(assistant([textBlock('b')], { output_tokens: 15 }))
    expect(out1[0]).toEqual({ type: 'progress', outputTokens: 10 })
    expect(out2[0]).toEqual({ type: 'progress', outputTokens: 25 })
  })

  it('treats a missing usage as zero tokens written', () => {
    const turn = new Turn('hi')
    const out = turn.read(assistant([textBlock('a')]))
    expect(out[0]).toEqual({ type: 'progress', outputTokens: 0 })
  })
})

describe('Turn — TodoWrite', () => {
  it('replaces the checklist wholesale', () => {
    const turn = new Turn('hi')
    turn.read(
      assistant([
        toolUseBlock('t1', 'TodoWrite', { todos: [{ content: 'first', status: 'completed' }, { content: 'second', status: 'in_progress' }] }),
      ]),
    )
    const out = turn.read(
      assistant([toolUseBlock('t2', 'TodoWrite', { todos: [{ content: 'only this now', status: 'pending' }] })]),
    )
    const todos = out.find((m) => m.type === 'todos')
    expect(todos).toEqual({ type: 'todos', todos: [{ content: 'only this now', status: 'pending' }] })
  })

  it('drops entries without string content and defaults unknown statuses to pending', () => {
    const turn = new Turn('hi')
    const out = turn.read(
      assistant([
        toolUseBlock('t1', 'TodoWrite', {
          todos: [{ content: 'kept', status: 'bogus' }, { content: 42, status: 'completed' }],
        }),
      ]),
    )
    const todos = out.find((m) => m.type === 'todos')
    expect(todos).toEqual({ type: 'todos', todos: [{ content: 'kept', status: 'pending' }] })
  })
})

describe('Turn — system init and compact_boundary', () => {
  it('announces init', () => {
    const turn = new Turn('hi')
    const out = turn.read(system({ subtype: 'init' }))
    expect(out).toEqual([{ type: 'system', subtype: 'init' }])
  })

  it('announces a compact_boundary — this is what the renderer\'s "compacted" toast keys off', () => {
    const turn = new Turn('hi')
    const out = turn.read(system({ subtype: 'compact_boundary' }))
    expect(out).toEqual([{ type: 'system', subtype: 'compact_boundary' }])
  })
})

describe('Turn — TaskCreate/TaskUpdate lifecycle', () => {
  it('picks the task number off the tool_result and lists it once it is known', () => {
    const turn = new Turn('hi')
    turn.read(assistant([toolUseBlock('t1', 'TaskCreate', { subject: 'Investigate the bug' })]))
    const out = turn.read(toolResult('t1', 'Task #3 created successfully'))
    const todos = out.find((m) => m.type === 'todos')
    expect(todos).toEqual({ type: 'todos', todos: [{ content: 'Investigate the bug', status: 'pending' }] })
  })

  it('does not list a task before the number comes back', () => {
    const turn = new Turn('hi')
    const out = turn.read(assistant([toolUseBlock('t1', 'TaskCreate', { subject: 'Investigate the bug' })]))
    expect(out.some((m) => m.type === 'todos')).toBe(false)
  })

  it('picks the task number off an array-of-blocks tool_result too, not only a plain string', () => {
    const turn = new Turn('hi')
    turn.read(assistant([toolUseBlock('t1', 'TaskCreate', { subject: 'Investigate the bug' })]))
    const out = turn.read(toolResult('t1', [{ type: 'text', text: 'Task #5 created successfully' }]))
    const todos = out.find((m) => m.type === 'todos')
    expect(todos).toEqual({ type: 'todos', todos: [{ content: 'Investigate the bug', status: 'pending' }] })
  })

  it('leaves a tool_result with no matching opening alone', () => {
    const turn = new Turn('hi')
    const out = turn.read(toolResult('unrelated', 'some output'))
    expect(out).toEqual([{ type: 'tool_result', id: 'unrelated', output: 'some output', failed: false }])
  })

  it('task_started puts the task on the board unless it is a housekeeping one', () => {
    const turn = new Turn('hi')
    const out = turn.read(system({ subtype: 'task_started', task_id: '7', description: 'Background sweep', skip_transcript: false }))
    expect(out).toEqual([{ type: 'todos', todos: [{ content: 'Background sweep', status: 'in_progress' }] }])
  })

  it('task_started with skip_transcript is invisible', () => {
    const turn = new Turn('hi')
    const out = turn.read(system({ subtype: 'task_started', task_id: '7', description: 'housekeeping', skip_transcript: true }))
    expect(out).toEqual([])
  })

  it('task_updated changes the status of a task already on the board', () => {
    const turn = new Turn('hi')
    turn.read(system({ subtype: 'task_started', task_id: '7', description: 'Background sweep', skip_transcript: false }))
    const out = turn.read(system({ subtype: 'task_updated', task_id: '7', patch: { status: 'completed' } }))
    expect(out).toEqual([{ type: 'todos', todos: [{ content: 'Background sweep', status: 'completed' }] }])
  })

  it('task_updated for an unknown task does nothing', () => {
    const turn = new Turn('hi')
    const out = turn.read(system({ subtype: 'task_updated', task_id: 'ghost', patch: { status: 'completed' } }))
    expect(out).toEqual([])
  })

  it('TaskUpdate tool_use updates a known task and reports it', () => {
    const turn = new Turn('hi')
    turn.read(system({ subtype: 'task_started', task_id: '7', description: 'Background sweep', skip_transcript: false }))
    const out = turn.read(assistant([toolUseBlock('t2', 'TaskUpdate', { taskId: '7', status: 'completed' })]))
    const todos = out.find((m) => m.type === 'todos')
    expect(todos).toEqual({ type: 'todos', todos: [{ content: 'Background sweep', status: 'completed' }] })
  })
})

describe('Turn — tool_result output', () => {
  it('truncates past 4000 characters', () => {
    const turn = new Turn('hi')
    const long = 'y'.repeat(4500)
    const out = turn.read(toolResult('t1', long))
    const toolResultMessage = out[0] as { output: string }
    expect(toolResultMessage.output).toBe(`${'y'.repeat(4000)}\n…(500 more characters)`)
  })

  it('reads an array of content blocks, turning images into a marker', () => {
    const turn = new Turn('hi')
    const out = turn.read(toolResult('t1', [{ type: 'text', text: 'first' }, { type: 'image' }, { type: 'text', text: 'second' }]))
    expect(out).toEqual([{ type: 'tool_result', id: 't1', output: 'first\n[image]\nsecond', failed: false }])
  })

  it('carries is_error through as failed', () => {
    const turn = new Turn('hi')
    const out = turn.read(toolResult('t1', 'oops', true))
    expect(out).toEqual([{ type: 'tool_result', id: 't1', output: 'oops', failed: true }])
  })

  it('produces nothing when the whole user message is a plain string rather than tool_result blocks', () => {
    const turn = new Turn('hi')
    const plainUserMessage = {
      type: 'user',
      message: { role: 'user', content: 'not a tool result at all' },
      parent_tool_use_id: null,
      uuid: 'u5',
      session_id: 's1',
    } as unknown as SDKMessage
    expect(turn.read(plainUserMessage)).toEqual([])
  })
})

describe('Turn — thinking', () => {
  it('splits into at most 3 first-lines of paragraphs', () => {
    const turn = new Turn('hi')
    const thinking = 'para one, line one\npara one, line two\n\npara two\n\npara three\n\npara four never shows'
    const out = turn.read(assistant([thinkingBlock(thinking)]))
    expect(out.filter((m) => m.type === 'thinking')).toEqual([
      { type: 'thinking', text: 'para one, line one' },
      { type: 'thinking', text: 'para two' },
      { type: 'thinking', text: 'para three' },
    ])
  })
})

describe('describeTool', () => {
  it('labels a tool with its mapped field', () => {
    expect(describeTool('Read', { file_path: '/a/b.ts' })).toBe('Read /a/b.ts')
    expect(describeTool('Bash', { description: 'run the tests' })).toBe('Bash run the tests')
    expect(describeTool('Grep', { pattern: 'TODO' })).toBe('Grep TODO')
  })

  it('cuts the field at 60 characters', () => {
    const long = 'x'.repeat(70)
    expect(describeTool('Read', { file_path: long })).toBe(`Read ${'x'.repeat(58)}…`)
  })

  it('falls back to the bare tool name when the field is missing or not a string', () => {
    expect(describeTool('AskUserQuestion', {})).toBe('AskUserQuestion')
    expect(describeTool('Read', { file_path: 42 })).toBe('Read')
    expect(describeTool('Read', {})).toBe('Read')
  })

  it('renames the expression tool label field', () => {
    expect(describeTool(EXPRESSION_TOOL, { expression: 'happy' })).toBe(`${EXPRESSION_TOOL} happy`)
  })
})
