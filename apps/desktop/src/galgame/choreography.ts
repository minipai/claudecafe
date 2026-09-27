import type { AgentMessage, Todo } from '@/agent'
import { EXPRESSIONS } from '@/agent/expressions'
import { text } from '@/i18n'
import { compactDetail, shorten } from './scene/chatlog'
import type { Hooks } from './dialogue/useSpeech'
import type { ChatMessage, Expression, Phase, Whisper } from './types'

/**
 * Everything the run choreography is allowed to do to the scene. Most of these
 * are the window's own state setters, taken as-is — the choreography only
 * decides which ones fire and in what order, never how they are stored.
 */
export type Scene = {
  appendChatMessage: (role: ChatMessage['role'], content: string, detail?: string) => void
  upsertStreamMessage: (id: string, content: string) => void
  appendEvent: (content: string, detail?: string, toolId?: string, output?: string) => void
  recordResult: (toolId: string, output: string, failed: boolean) => void
  say: (text: string, hooks?: Hooks) => void
  stream: (id: string, text: string, done: boolean, hooks?: Hooks) => void
  act: (play: () => void) => void
  wear: (expr?: Expression, marker?: string) => void
  /** The bare face, with no marker to sign it — a tool changing her expression
   * mid-turn, not a line taking the box. */
  showFace: (expr: Expression) => void
  pushWhisper: (text: string, kind: Whisper['kind']) => void
  setPhase: (phase: Phase) => void
  setTodos: (todos: Todo[]) => void
  setOutputTokens: (tokens: number) => void
  setLaidOut: (line: string | null) => void
  notify: (body: string) => void
}

/** She only ever names one of her own faces — a hallucinated name is not one
 * of them, and is worth ignoring rather than handed straight to an <img>. */
function isExpression(value: unknown): value is Expression {
  return typeof value === 'string' && (EXPRESSIONS as readonly string[]).includes(value)
}

/** What one message off the agent stream does to the scene. */
export function choreograph(msg: AgentMessage, scene: Scene) {
  switch (msg.type) {
    case 'system':
      if (msg.subtype === 'compact_boundary') {
        scene.appendChatMessage('boundary', text().log.compacted, compactDetail(msg.compact))
      }
      break
    case 'text_delta':
      // Into the log the moment she says it — the log is the conversation as
      // it happens, not a summary written at the end of the turn. It goes in
      // exactly as received; mood is metadata used only to choose her face.
      scene.appendChatMessage('assistant', msg.text)
      scene.say(msg.text, { onShow: () => scene.wear(msg.expression, msg.mood) })
      break
    case 'text_stream':
      scene.upsertStreamMessage(msg.id, msg.text)
      scene.stream(msg.id, msg.text, msg.done, { onShow: () => scene.wear(msg.expression, msg.mood) })
      break
    case 'command_output':
      // The café's own paperwork, handed over on the spot: it is not
      // dialogue, so nothing is typed into the box and her face stays put.
      // It goes on the record instead, where the master looks for what she
      // actually did and what came back of it.
      scene.appendEvent(msg.label, text().scene.printedAnswer, undefined, msg.body)
      // Nothing follows it — the turn asked no model and has no result to
      // put her back on her feet.
      scene.setPhase('done')
      break
    case 'todos':
      // Task state follows real time. Replaying an older snapshot after a
      // completion notification would put finished work back on the board.
      scene.setTodos(msg.todos)
      break
    case 'thinking':
      scene.act(() => scene.pushWhisper(msg.text, 'thought'))
      break
    case 'progress':
      // A measurement, not a beat: it belongs to the clock running in the
      // corner and not to the scene the master is clicking through.
      scene.setOutputTokens(msg.outputTokens)
      break
    case 'tool_use': {
      // The log is a record and keeps real time; the whisper and the face
      // belong to the scene, so they wait for the master to reach them.
      scene.appendEvent(msg.label || msg.name, undefined, msg.id)
      if (msg.name === 'set_expression') {
        // Unknown name: her face stays whatever it already was, rather than
        // handing an <img> a src that names nothing.
        const wanted = msg.input?.expression
        if (isExpression(wanted)) scene.act(() => scene.showFace(wanted))
      } else if (!msg.silent) {
        scene.act(() => scene.pushWhisper(msg.label, 'tool'))
      }
      break
    }
    case 'tool_result':
      scene.recordResult(msg.id, msg.output, msg.failed)
      // A tool that failed is worth saying out loud in the scene; the rest
      // is only worth having on the record.
      if (msg.failed) scene.act(() => scene.pushWhisper(text().scene.toolFailed, 'tool'))
      break
    case 'result':
      // Done, and he is somewhere else: what she ended on is worth hearing
      // there rather than sitting unread in a window behind everything.
      scene.notify(shorten(msg.line))
      // A line already spoken went on the record when she said it, marker
      // included; the result is that same line coming back round.
      if (!msg.said) scene.appendChatMessage('assistant', msg.line)
      // A long piece of work leaves her board up; anything shorter puts her
      // back to waiting the moment the line lands.
      scene.setPhase(msg.tier === 'heavy' ? 'done' : 'idle')
      // Already on screen: the result is just the record of what she said.
      if (msg.said) break
      if (msg.tier === 'medium') {
        // Laid out rather than typed, but it still waits its turn behind
        // anything she said on the way here.
          scene.say(msg.line, {
          onShow: () => {
            scene.wear(msg.expression, msg.mood)
            scene.setLaidOut(msg.line)
          },
        })
      } else {
        scene.say(msg.line, { onShow: () => scene.wear(msg.expression, msg.mood) })
      }
      break
  }
}
