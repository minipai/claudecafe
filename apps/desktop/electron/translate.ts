import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentMessage, Report, Todo } from '../src/agent/types'
import { EXPRESSION_TOOL, REPORT_TOOL } from './tools'
import { faceFor, type Expression } from '../src/agent/expressions'

/** The model a locally-answered slash command comes back as: the CLI printed it
 * itself, without asking the model anything. */
const LOCAL_COMMAND = '<synthetic>'

/** A run's worth of translation state — one turn, from prompt to result. */
export class Turn {
  /** Set when the CLI answered the turn itself, so the result that follows is
   * the same text coming back round and is not said again. */
  private printed = false

  /** The last spoken text block, held back so it can become the result line
   * instead of being said twice — with the face she signed it with, which
   * belongs to that line and not to the one still on screen. */
  private pendingLine: { text: string; expression: Expression | null; marker: string | null } | null = null
  private tasks = new Map<string, Todo>()
  /** Her own checklist, as she last wrote it. Background tasks the SDK reports
   * separately are pinned under it. */
  private todos: Todo[] = []
  /** Tasks she has just asked for, by the call that asked — the board can only
   * list one once the tool answers with the number it gave it. */
  private opening = new Map<string, string>()
  /** Set once she calls the report tool: what the panel shows, and the line she
   * says while handing it over. */
  private report: (Report & { line: string }) | null = null
  /** The mood marker she signed her last line with, kept for the log — the
   * scene strips it, but the record should read the way she wrote it. */
  private mood: string | null = null
  /** The last line already put on screen, so the result does not repeat it. */
  private spoken: string | null = null
  /** How many tokens she has written this turn, for the line he waits at. */
  private written = 0

  /** The prompt this turn was started with — only read to name the slash
   * command, when the turn turns out to be one. */
  constructor(private prompt: string = '') {}

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
      default:
        return []
    }
  }

  private readSystem(sdk: Extract<SDKMessage, { type: 'system' }>): AgentMessage[] {
    if (sdk.subtype === 'init') return [{ type: 'system', subtype: 'init' }]
    if (sdk.subtype === 'compact_boundary') return [{ type: 'system', subtype: 'compact_boundary' }]

    if (sdk.subtype === 'task_started') {
      if (sdk.skip_transcript) return []
      this.tasks.set(sdk.task_id, { content: sdk.description, status: 'in_progress' })
      return [this.todoList()]
    }
    if (sdk.subtype === 'task_updated') {
      const task = this.tasks.get(sdk.task_id)
      if (!task) return []
      if (sdk.patch.description) task.content = sdk.patch.description
      if (sdk.patch.status) task.status = TASK_STATUS[sdk.patch.status]
      return [this.todoList()]
    }
    return []
  }

  /**
   * A slash command the CLI answers by itself — /usage, /context, /model. It
   * arrives as an assistant message from `<synthetic>`, which is the tell: no
   * model was asked, so the text is the terminal's, not hers. Every one of them
   * comes back this way, so they share this one door into the scene.
   */
  private readPrinted(sdk: Extract<SDKMessage, { type: 'assistant' }>): AgentMessage[] {
    this.printed = true
    const body = sdk.message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n\n')
      .trim()
    if (!body) return []
    return [{ type: 'command_output', label: this.prompt.trim().split(/\s+/)[0], body }]
  }

  private readAssistant(sdk: Extract<SDKMessage, { type: 'assistant' }>): AgentMessage[] {
    if (sdk.message.model === LOCAL_COMMAND) return this.readPrinted(sdk)
    const out: AgentMessage[] = []

    // Each message reports what it cost on its own, so the figure the master
    // watches while he waits is the sum of them rather than any one of them.
    this.written += sdk.message.usage?.output_tokens ?? 0
    out.push({ type: 'progress', outputTokens: this.written })

    for (const block of sdk.message.content) {
      if (block.type === 'text') {
        this.flush(out)
        const { text, expression, marker } = readMood(block.text)
        if (marker) this.mood = marker
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
          this.opening.set(block.id, input.subject)
        }
        if (block.name === 'TaskUpdate') {
          const task = this.tasks.get(String(input.taskId))
          if (task) {
            task.status = TASK_STATUS[String(input.status)] ?? task.status
            out.push(this.todoList())
          }
        }
        if (block.name === 'TodoWrite') {
          this.todos = readTodos(input.todos)
          out.push(this.todoList())
        }
        if (block.name === REPORT_TOOL) {
          this.report = {
            line: String(input.line ?? ''),
            label: String(input.label ?? '') || FALLBACK_LABEL,
            body: String(input.body ?? ''),
          }
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
          silent: SILENT_TOOLS.has(block.name) || block.name === REPORT_TOOL,
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

      const subject = this.opening.get(block.tool_use_id)
      if (!subject) continue
      this.opening.delete(block.tool_use_id)
      const numbered = typeof block.content === 'string' ? block.content.match(/Task #(\d+)/) : null
      if (!numbered) continue
      this.tasks.set(numbered[1], { content: subject, status: 'pending' })
      opened = true
    }
    return opened ? [...out, this.todoList()] : out
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
    out.push({ type: 'text_delta', text, expression: expression ?? undefined, mood: marker ?? undefined })
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
    const held = this.pendingLine
    const ending = held ?? (sdk.subtype === 'success' ? readMood(sdk.result) : null)
    const text = ending?.text ?? ''
    const expression = (held?.expression ?? undefined) || undefined
    // Her last word was already said on the way to a tool call; the result is
    // the same text coming back round, so the scene must not say it twice.
    const said = !held && text === this.spoken
    this.pendingLine = null
    this.spoken = null
    const mood = this.mood ?? undefined
    this.mood = null

    // She handed over a report: that is the answer, whatever she said after.
    if (this.report) {
      const { line, label, body } = this.report
      this.report = null
      return [
        {
          type: 'result',
          tier: 'heavy',
          line: line || text || openingLine(body),
          mood,
          expression,
          report: { label, body },
        },
      ]
    }
    if (!text) return []

    // No tool call, but the answer came out long anyway — still worth a panel.
    if (isLongForm(text)) {
      return [
        {
          type: 'result',
          tier: 'heavy',
          line: openingLine(text),
          mood,
          expression,
          said,
          report: { label: FALLBACK_LABEL, body: text },
        },
      ]
    }
    return [{ type: 'result', tier: hasShape(text) ? 'medium' : 'light', line: text, mood, expression, said }]
  }

  private todoList(): AgentMessage {
    return { type: 'todos', todos: [...this.todos, ...this.tasks.values()] }
  }
}

/** Tools that already have their own place on screen — the choice row, the task
 * board, the plan prompt — so they don't also whisper past as narration. */
const SILENT_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode', 'TodoWrite', 'TaskCreate', 'TaskUpdate'])

/**
 * A maid ends her replies with a mood marker — `【 開心 (˶ˆᗜˆ˵) 】`. That is
 * where the sprite's face comes from: the kaomoji picks the artwork and the
 * marker itself is taken off the line before she says it. No marker (a plain
 * project with no persona) just means she keeps a straight face.
 */
function readMood(raw: string) {
  const marker = raw.match(/【[^【】]*】\s*$/)
  const text = (marker ? raw.slice(0, marker.index) : raw).trim()
  if (!marker) return { text, expression: null, marker: null }
  return { text, expression: faceFor(marker[0]), marker: marker[0] }
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

/** She forgot to hand it over, but it is far too long to say — the panel takes
 * it anyway. A medium-length answer is still spoken. */
function isLongForm(text: string) {
  return text.length > 1200 || /^#{1,4} /m.test(text) || text.includes('```')
}

/**
 * Markdown she meant as markdown — a list, inline code, a bold run — or simply
 * more than fits on one line of the box. Said out loud either way, but laid out
 * instead of read as raw characters.
 */
function hasShape(text: string) {
  return text.length > 160 || /(^|\n)\s*[-*+] |(^|\n)\s*\d+\. |`[^`]+`|\*\*[^*]+\*\*/.test(text)
}

/** Used when she never wrote a label herself — the panel still needs a way in. */
const FALLBACK_LABEL = 'View full report →'

/** The line said out loud when the body goes to the report panel. */
function openingLine(text: string) {
  const first = text.split('\n').find((line) => line.trim() && !line.startsWith('#'))?.trim() ?? ''
  return first.length > 120 ? `${first.slice(0, 118)}…` : first || 'Done — the write-up is ready.'
}

/** As much of a tool's answer as is worth keeping in a window. A grep over a
 * repository answers with more than anyone reads; the rest is said to be there
 * rather than carried around. */
const KEPT = 4000

function readOutput(content: unknown): string {
  const text =
    typeof content === 'string'
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
  [REPORT_TOOL]: 'label',
}

/** A plain label for the whisper bubble — what she is doing, in a few words. */
export function describeTool(name: string, input: Record<string, unknown>) {
  const value = input[FIELD_BY_TOOL[name] ?? '']
  if (typeof value !== 'string' || !value) return name
  const short = value.length > 60 ? `${value.slice(0, 58)}…` : value
  return `${name} ${short}`
}
