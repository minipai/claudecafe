import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { randomUUID } from 'node:crypto'
import type { AgentMessage, Todo } from '../../src/agent/types'
import { EXPRESSION_TOOL } from './tools'
import { faceFor, type Expression } from '../../src/agent/expressions'

/** The model a locally-answered slash command comes back as: the CLI printed it
 * itself, without asking the model anything. */
const LOCAL_COMMAND = '<synthetic>'

/**
 * Her task list, kept for the whole conversation rather than one turn: a task
 * she opens in one answer is ticked off in a later one, and the board stays up
 * until the last of it is done — the same as the CLI's.
 */
export class Board {
  readonly tasks = new Map<string, Todo>()
  /** Her own checklist, as she last wrote it. Background tasks the SDK reports
   * separately are pinned under it. */
  todos: Todo[] = []
  /** Tasks she has just asked for, by the call that asked — the board can only
   * list one once the tool answers with the number it gave it. */
  readonly opening = new Map<string, string>()

  list(): AgentMessage {
    return { type: 'todos', todos: [...this.todos, ...this.tasks.values()] }
  }

  /** SDK task lifetimes belong to the session, and can outlast a reply. */
  read(sdk: Extract<SDKMessage, { type: 'system' }>): AgentMessage | null {
    if (sdk.subtype === 'task_started') {
      if (sdk.skip_transcript) return null
      this.tasks.set(sdk.task_id, { content: sdk.description, status: 'in_progress' })
      return this.list()
    }
    if (sdk.subtype === 'task_updated') {
      const task = this.tasks.get(sdk.task_id)
      if (!task) return null
      if (sdk.patch.description) task.content = sdk.patch.description
      if (sdk.patch.status) task.status = TASK_STATUS[sdk.patch.status]
      return this.list()
    }
    if (sdk.subtype === 'task_notification') {
      const task = this.tasks.get(sdk.task_id)
      if (!task) return null
      // This board tracks outstanding work. Completed, failed and stopped
      // tasks are all terminal; the SDK's result carries their outcome.
      task.status = 'completed'
      return this.list()
    }
    return null
  }
}

/** A run's worth of translation state — one turn, from prompt to result. */
export class Turn {
  /** Set when the CLI answered the turn itself, so the result that follows is
   * the same text coming back round and is not said again. */
  private printed = false

  /** The last spoken text block, held back so it can become the result line
   * instead of being said twice — with the face she signed it with, which
   * belongs to that line and not to the one still on screen. */
  private pendingLine: { text: string; expression: Expression | null; marker: string | null; streamId?: string } | null = null
  /** The last line already put on screen, so the result does not repeat it. */
  private spoken: string | null = null
  /** How many tokens she has written this turn, for the line he waits at. */
  private written = 0
  private streamBlocks = new Map<number, { id: string; text: string; canonical: boolean }>()
  private streamMessageModel: string | null = null

  /** The prompt this turn was started with — only read to name the slash
   * command, when the turn turns out to be one. The board is the
   * conversation's, handed to every turn in it. */
  constructor(
    private prompt: string = '',
    private board: Board = new Board(),
  ) {}

  /** Turns one SDK message into however many the galgame UI understands. */
  read(sdk: SDKMessage): AgentMessage[] {
    switch (sdk.type) {
      case 'system':
        return this.readSystem(sdk)
      case 'assistant':
        return this.readAssistant(sdk)
      case 'user':
        return this.readToolResults(sdk)
      case 'result':
        return this.readResult(sdk)
      case 'stream_event':
        return this.readStreamEvent(sdk)
      default:
        return []
    }
  }

  private readStreamEvent(sdk: Extract<SDKMessage, { type: 'stream_event' }>): AgentMessage[] {
    const event = sdk.event
    if (event.type === 'message_start') {
      this.streamBlocks.clear()
      this.streamMessageModel = event.message.model
      return []
    }
    if (this.streamMessageModel === LOCAL_COMMAND) return []
    if (event.type === 'content_block_start' && event.content_block.type === 'text') {
      const block = { id: randomUUID(), text: event.content_block.text, canonical: false }
      this.streamBlocks.set(event.index, block)
      return this.streamSnapshot(block, false)
    }
    const block = 'index' in event ? this.streamBlocks.get(event.index) : undefined
    if (!block) return []
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') block.text += event.delta.text
    else if (event.type !== 'content_block_stop') return []
    const complete = event.type === 'content_block_stop'
    return this.streamSnapshot(block, complete)
  }

  private streamSnapshot(block: { id: string; text: string }, done: boolean): AgentMessage[] {
    const { expression, marker } = readMood(block.text)
    this.pendingLine = { text: block.text, expression, marker, streamId: block.id }
    return [{ type: 'text_stream', id: block.id, text: block.text, done, expression: expression ?? undefined, mood: marker ?? undefined }]
  }

  private readSystem(sdk: Extract<SDKMessage, { type: 'system' }>): AgentMessage[] {
    if (sdk.subtype === 'init') return [{ type: 'system', subtype: 'init' }]
    if (sdk.subtype === 'compact_boundary') {
      const metadata = sdk.compact_metadata
      return [{
        type: 'system', subtype: 'compact_boundary',
        compact: metadata ? {
          ...(metadata.trigger === 'manual' || metadata.trigger === 'auto' ? { trigger: metadata.trigger } : {}),
          ...(typeof metadata.pre_tokens === 'number' ? { preTokens: metadata.pre_tokens } : {}),
          ...(typeof metadata.post_tokens === 'number' ? { postTokens: metadata.post_tokens } : {}),
          ...(typeof metadata.duration_ms === 'number' ? { durationMs: metadata.duration_ms } : {}),
        } : undefined,
      }]
    }

    const update = this.board.read(sdk)
    return update ? [update] : []
  }

  /**
   * A slash command the CLI answers by itself — /usage, /context, /model. It
   * arrives as an assistant message from `<synthetic>`, which is the tell: no
   * model was asked, so the text is the terminal's, not hers. Every one of them
   * comes back this way, so they share this one door into the scene.
   */
  private readPrinted(sdk: Extract<SDKMessage, { type: 'assistant' }>): AgentMessage[] {
    this.printed = true
    // The synthetic assistant channel also carries failures. They are not
    // locally answered commands, even when the CLI printed the error text.
    if (sdk.error) return []
    const body = sdk.message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n\n')
      .trim()
    if (/^Failed to authenticate:/i.test(body)) return []
    if (!body) return []
    return [{ type: 'command_output', label: this.prompt.trim().split(/\s+/)[0], body }]
  }

  private readAssistant(sdk: Extract<SDKMessage, { type: 'assistant' }>): AgentMessage[] {
    if (sdk.message.model === LOCAL_COMMAND) {
      this.streamBlocks.clear()
      this.streamMessageModel = null
      return this.readPrinted(sdk)
    }
    const out: AgentMessage[] = []

    // Each message reports what it cost on its own, so the figure the master
    // watches while he waits is the sum of them rather than any one of them.
    this.written += sdk.message.usage?.output_tokens ?? 0
    out.push({ type: 'progress', outputTokens: this.written })

    for (const block of sdk.message.content) {
      if (block.type === 'text') {
        const { expression, marker } = readMood(block.text)
        const text = block.text
        // Claude Code emits an assistant message for each completed block:
        // its content[0] can belong to stream index 1, after a thinking block.
        // Consume streamed text blocks in order, keeping their SDK indices for
        // the content_block_stop events that arrive after these messages.
        const streamed = [...this.streamBlocks.values()].find((part) => !part.canonical)
        if (streamed) {
          streamed.canonical = true
          streamed.text = block.text
        }
        if (streamed && text) {
          this.flush(out)
          out.push({ type: 'text_stream', id: streamed.id, text, done: true, expression: expression ?? undefined, mood: marker ?? undefined })
          this.pendingLine = { text, expression, marker, streamId: streamed.id }
          continue
        }
        // Each SDK text block is its own body, including a marker-only block.
        // Flush the prior block and keep this one verbatim rather than merging
        // the two or transferring its marker across the boundary.
        this.flush(out)
        this.pendingLine = text ? { text, expression, marker } : null
      } else if (block.type === 'thinking') {
        this.flush(out)
        for (const line of splitThought(block.thinking)) out.push({ type: 'thinking', text: line })
      } else if (block.type === 'tool_use') {
        // She said something and then went and did this — in that order, so the
        // line goes out before the doing of it.
        this.flush(out)
        const input = (block.input ?? {}) as Record<string, unknown>
        const label = describeTool(block.name, input)
        if (block.name === 'TaskCreate' && typeof input.subject === 'string') {
          this.board.opening.set(block.id, input.subject)
        }
        if (block.name === 'TaskUpdate') {
          const task = this.board.tasks.get(String(input.taskId))
          if (task) {
            task.status = TASK_STATUS[String(input.status)] ?? task.status
            out.push(this.board.list())
          }
        }
        if (block.name === 'TodoWrite') {
          this.board.todos = readTodos(input.todos)
          out.push(this.board.list())
        }
        // Every call is reported, because the log is where the master goes to
        // find out what she actually did. `silent` only means it has its own
        // place on screen already and should not also whisper past as narration.
        out.push({
          type: 'tool_use',
          id: block.id,
          name: block.name === EXPRESSION_TOOL ? 'set_expression' : block.name,
          label,
          input,
          silent: SILENT_TOOLS.has(block.name),
        })
      }
    }
    return out
  }

  /**
   * What the tools answered. Every answer is passed on under the id of the call
   * it belongs to — the log is where the master goes to see what actually came
   * back, not just what she went off to do.
   *
   * One of them is also read here: TaskCreate answers "Task #3 created
   * successfully", and that number is how every later update refers to the
   * task, so the board cannot list it before then.
   */
  private readToolResults(sdk: Extract<SDKMessage, { type: 'user' }>): AgentMessage[] {
    const content = sdk.message.content
    if (typeof content === 'string') return []
    const out: AgentMessage[] = []
    let opened = false

    for (const block of content) {
      if (block.type !== 'tool_result') continue
      out.push({
        type: 'tool_result',
        id: block.tool_use_id,
        output: readOutput(block.content),
        failed: block.is_error === true,
      })

      const subject = this.board.opening.get(block.tool_use_id)
      if (!subject) continue
      this.board.opening.delete(block.tool_use_id)
      const numbered = contentText(block.content).match(/Task #(\d+)/)
      if (!numbered) continue
      this.board.tasks.set(numbered[1], { content: subject, status: 'pending' })
      opened = true
    }
    return opened ? [...out, this.board.list()] : out
  }

  /**
   * Say the line she is holding. A line is held only until the next thing
   * happens: if that is another line, this one was said on the way; if it is
   * the end of the turn, this one was the answer.
   */
  private flush(out: AgentMessage[]) {
    if (!this.pendingLine) return
    const { text, expression, marker } = this.pendingLine
    // The marker goes with the line it was written on, not with the end of the
    // turn: she signs every block she writes, and the one on screen is the one
    // whose mood is being worn.
    if (!this.pendingLine.streamId) out.push({ type: 'text_delta', text, expression: expression ?? undefined, mood: marker ?? undefined })
    this.spoken = text
    this.pendingLine = null
  }

  private readResult(sdk: Extract<SDKMessage, { type: 'result' }>): AgentMessage[] {
    // The command printed its own answer; the result is that same text coming
    // back round, and she never said any of it.
    if (this.printed) {
      this.printed = false
      return []
    }
    if (sdk.subtype !== 'success') {
      this.pendingLine = null
      this.spoken = null
      return []
    }
    const held = this.pendingLine
    const ending = held ?? readMood(sdk.result)
    const text = ending.text
    // The face belongs to whichever line is actually ending the turn — the
    // held one if there was one, or the result text's own marker when the
    // marker rode along in the result instead of a streamed block.
    const expression = ending?.expression ?? held?.expression ?? undefined
    // Her last word was already said on the way to a tool call; the result is
    // the same text coming back round, so the scene must not say it twice.
    const said = Boolean(held?.streamId) || (!held && text === this.spoken)
    this.pendingLine = null
    this.spoken = null
    // Only the ending line's own marker signs the result — an earlier line's
    // mood belongs to that line, not to whatever she ended on.
    const mood = ending?.marker ?? undefined

    if (!text) return []

    return [{ type: 'result', tier: hasShape(text) ? 'medium' : 'light', line: text, mood, expression, said }]
  }
}

/** Tools that already have their own place on screen — the choice row, the task
 * board, the plan prompt — so they don't also whisper past as narration. */
const SILENT_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode', 'TodoWrite', 'TaskCreate', 'TaskUpdate'])

/** Read expression metadata without changing the model-authored body. */
function readMood(raw: string) {
  const marker = raw.match(/【[^【】]*】(?=\s*$)/)
  if (!marker) return { text: raw, expression: null, marker: null }
  return { text: raw, expression: faceFor(marker[0]), marker: marker[0] }
}

/** The checklist as TodoWrite writes it: content plus a status the board knows. */
function readTodos(raw: unknown): Todo[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    const item = entry as { content?: unknown; status?: unknown }
    if (typeof item.content !== 'string') return []
    const status = item.status === 'in_progress' || item.status === 'completed' ? item.status : 'pending'
    return [{ content: item.content, status }]
  })
}

const TASK_STATUS: Record<string, Todo['status']> = {
  pending: 'pending',
  in_progress: 'in_progress',
  running: 'in_progress',
  paused: 'in_progress',
  completed: 'completed',
  failed: 'completed',
  killed: 'completed',
}

/**
 * Markdown she meant as markdown — a heading, a list, a code block, a bold run
 * — or simply more than fits on one line of the box. Said out loud either way,
 * but laid out instead of read as raw characters.
 */
export function hasShape(text: string) {
  return (
    text.length > 160
    || /^#{1,4} /m.test(text)
    || text.includes('```')
    || /(^|\n)\s*[-*+] |(^|\n)\s*\d+\. |`[^`]+`|\*\*[^*]+\*\*/.test(text)
  )
}

/** As much of a tool's answer as is worth keeping in a window. A grep over a
 * repository answers with more than anyone reads; the rest is said to be there
 * rather than carried around. */
const KEPT = 4000

/** The plain text a tool_result actually carries, string or blocks alike —
 * whatever else reads a tool's answer, the "Task #3 created" number among
 * them, reads it through here rather than assuming which shape it arrived in. */
function contentText(content: unknown): string {
  return typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .map((block) => {
            const part = block as { type?: string; text?: string }
            if (part.type === 'text') return part.text ?? ''
            return part.type === 'image' ? '[image]' : ''
          })
          .filter(Boolean)
          .join('\n')
      : ''
}

function readOutput(content: unknown): string {
  const text = contentText(content)
  return text.length > KEPT ? `${text.slice(0, KEPT)}\n…(${text.length - KEPT} more characters)` : text
}

/** Thinking arrives as a paragraph; the whisper band wants one thought at a time. */
function splitThought(thinking: string) {
  return thinking
    .split(/\n{2,}/)
    .map((part) => part.trim().split('\n')[0])
    .filter(Boolean)
    .slice(0, 3)
}

const FIELD_BY_TOOL: Record<string, string> = {
  Read: 'file_path',
  Edit: 'file_path',
  Write: 'file_path',
  Bash: 'description',
  Glob: 'pattern',
  Grep: 'pattern',
  WebFetch: 'url',
  WebSearch: 'query',
  Task: 'description',
  Skill: 'skill',
  TaskCreate: 'subject',
  [EXPRESSION_TOOL]: 'expression',
}

/** A plain label for the whisper bubble — what she is doing, in a few words. */
export function describeTool(name: string, input: Record<string, unknown>) {
  const value = input[FIELD_BY_TOOL[name] ?? '']
  if (typeof value !== 'string' || !value) return name
  const short = value.length > 60 ? `${value.slice(0, 58)}…` : value
  return `${name} ${short}`
}
