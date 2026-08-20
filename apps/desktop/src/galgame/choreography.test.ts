import { describe, expect, it, vi } from 'vitest'
import type { Look, Report } from '@/agent'
import { choreograph, type Scene } from './choreography'

function createScene(): Scene {
  return {
    appendChatMessage: vi.fn(),
    appendEvent: vi.fn(),
    recordResult: vi.fn(),
    say: vi.fn(),
    // Acts play immediately in these tests — the queueing itself belongs to
    // useSpeech, not to the choreography that decides an act should happen.
    act: vi.fn((play: () => void) => play()),
    wear: vi.fn(),
    showFace: vi.fn(),
    pushWhisper: vi.fn(),
    setPhase: vi.fn(),
    setReport: vi.fn(),
    setCtaVisible: vi.fn(),
    setTodos: vi.fn(),
    setOutputTokens: vi.fn(),
    setLook: vi.fn(),
    setLookUnread: vi.fn(),
    setReaderOpen: vi.fn(),
    setLaidOut: vi.fn(),
    notify: vi.fn(),
  }
}

/** Fires whatever `onShow`/`onDone` the choreography handed to `say`, the way
 * the box would once the line actually reaches it. */
function showLastLine(scene: Scene) {
  const call = vi.mocked(scene.say).mock.calls.at(-1)
  call?.[1]?.onShow?.()
}

function finishLastLine(scene: Scene) {
  const call = vi.mocked(scene.say).mock.calls.at(-1)
  call?.[1]?.onDone?.()
}

describe('choreograph', () => {
  it('does nothing for a system message', () => {
    const scene = createScene()
    choreograph({ type: 'system', subtype: 'init' }, scene)
    expect(Object.values(scene).every((fn) => (fn as ReturnType<typeof vi.fn>).mock.calls.length === 0)).toBe(true)
  })

  it('text_delta: logs the line signed, says it stripped, and wears whatever face and mood it arrives with', () => {
    const scene = createScene()
    choreograph({ type: 'text_delta', text: 'hello there', expression: 'happy', mood: '【 開心 】' }, scene)
    // On the record the way she wrote it, marker and all — written once, when
    // she said it, rather than gone back over at the end of the turn.
    expect(scene.appendChatMessage).toHaveBeenCalledWith('assistant', 'hello there 【 開心 】')
    expect(scene.say).toHaveBeenCalledWith('hello there', expect.any(Object))
    showLastLine(scene)
    expect(scene.wear).toHaveBeenCalledWith('happy', '【 開心 】')
  })

  it('text_delta: a line with no marker of its own tells wear to drop whatever the last one left in the corner', () => {
    const scene = createScene()
    choreograph({ type: 'text_delta', text: 'still thinking about this one' }, scene)
    showLastLine(scene)
    // `wear`'s own job is clearing the mood when the marker is undefined —
    // the choreography's part is passing it through rather than the last one.
    expect(scene.wear).toHaveBeenCalledWith(undefined, undefined)
  })

  it('look: shoots a fresh look and marks it unread', () => {
    const scene = createScene()
    const look: Look = { scene: 'she is typing', dialogue: 'almost there~' }
    choreograph({ type: 'look', look }, scene)
    expect(scene.setLook).toHaveBeenCalledWith(look)
    expect(scene.setLookUnread).toHaveBeenCalledWith(true)
  })

  it('command_output: hands the paper over and ends the turn at phase done, without touching her face', () => {
    const scene = createScene()
    choreograph({ type: 'command_output', label: '/usage', body: 'the printed answer' }, scene)
    expect(scene.appendEvent).toHaveBeenCalledWith('/usage', expect.any(String), undefined, 'the printed answer')
    expect(scene.setReport).toHaveBeenCalledWith({ label: '/usage →', body: 'the printed answer' })
    expect(scene.setCtaVisible).toHaveBeenCalledWith(true)
    expect(scene.setReaderOpen).toHaveBeenCalledWith(true)
    expect(scene.setPhase).toHaveBeenCalledWith('done')
    expect(scene.say).not.toHaveBeenCalled()
    expect(scene.wear).not.toHaveBeenCalled()
  })

  it('todos: replaces the board as an act, not a click-through beat', () => {
    const scene = createScene()
    const todos = [{ content: 'do the thing', status: 'pending' as const }]
    choreograph({ type: 'todos', todos }, scene)
    expect(scene.act).toHaveBeenCalled()
    expect(scene.setTodos).toHaveBeenCalledWith(todos)
  })

  it('thinking: whispers the thought as an act', () => {
    const scene = createScene()
    choreograph({ type: 'thinking', text: 'let me look at this' }, scene)
    expect(scene.act).toHaveBeenCalled()
    expect(scene.pushWhisper).toHaveBeenCalledWith('let me look at this', 'thought')
  })

  it('progress: just updates the token count', () => {
    const scene = createScene()
    choreograph({ type: 'progress', outputTokens: 42 }, scene)
    expect(scene.setOutputTokens).toHaveBeenCalledWith(42)
  })

  it('tool_use set_expression: puts the face straight on, bare, with no whisper', () => {
    const scene = createScene()
    choreograph(
      { type: 'tool_use', id: 'call-1', name: 'set_expression', label: '', input: { expression: 'proud' } },
      scene,
    )
    // An empty label falls back to the tool's own name — same as any other tool call.
    expect(scene.appendEvent).toHaveBeenCalledWith('set_expression', undefined, 'call-1')
    expect(scene.showFace).toHaveBeenCalledWith('proud')
    // A bare expression change is not a spoken line, so the mood in the
    // corner — which only `wear` touches — is left exactly as it was.
    expect(scene.wear).not.toHaveBeenCalled()
    expect(scene.pushWhisper).not.toHaveBeenCalled()
  })

  it('tool_use set_expression: a name she has no artwork for leaves her face as it was', () => {
    const scene = createScene()
    choreograph(
      { type: 'tool_use', id: 'call-1', name: 'set_expression', label: '', input: { expression: 'excited' } },
      scene,
    )
    expect(scene.showFace).not.toHaveBeenCalled()
    expect(scene.act).not.toHaveBeenCalled()
  })

  it('tool_use set_expression: no input at all is the same as an unknown name', () => {
    const scene = createScene()
    choreograph({ type: 'tool_use', id: 'call-1', name: 'set_expression', label: '' }, scene)
    expect(scene.showFace).not.toHaveBeenCalled()
  })

  it('tool_use, not silent: logs it and whispers what she is doing', () => {
    const scene = createScene()
    choreograph({ type: 'tool_use', id: 'call-2', name: 'Read', label: 'reading a file' }, scene)
    expect(scene.appendEvent).toHaveBeenCalledWith('reading a file', undefined, 'call-2')
    expect(scene.pushWhisper).toHaveBeenCalledWith('reading a file', 'tool')
  })

  it('tool_use, silent: logs it but says nothing — it already has its own place on screen', () => {
    const scene = createScene()
    choreograph({ type: 'tool_use', id: 'call-3', name: 'TodoWrite', label: 'updating tasks', silent: true }, scene)
    expect(scene.appendEvent).toHaveBeenCalledWith('updating tasks', undefined, 'call-3')
    expect(scene.act).not.toHaveBeenCalled()
    expect(scene.pushWhisper).not.toHaveBeenCalled()
  })

  it('tool_result, succeeded: records the answer and stays quiet', () => {
    const scene = createScene()
    choreograph({ type: 'tool_result', id: 'call-1', output: 'it worked', failed: false }, scene)
    expect(scene.recordResult).toHaveBeenCalledWith('call-1', 'it worked', false)
    expect(scene.pushWhisper).not.toHaveBeenCalled()
  })

  it('tool_result, failed: records it and whispers that it did not work', () => {
    const scene = createScene()
    choreograph({ type: 'tool_result', id: 'call-1', output: 'it broke', failed: true }, scene)
    expect(scene.recordResult).toHaveBeenCalledWith('call-1', 'it broke', true)
    expect(scene.act).toHaveBeenCalled()
    expect(scene.pushWhisper).toHaveBeenCalledWith(expect.any(String), 'tool')
  })

  describe('result: light', () => {
    it('not already said: logs it signed, says it, and goes idle', () => {
      const scene = createScene()
      const report: Report = { label: 'label', body: 'body' }
      choreograph(
        { type: 'result', tier: 'light', line: 'all done~', mood: '【 開心 】', expression: 'happy', report },
        scene,
      )
      expect(scene.notify).toHaveBeenCalledWith('all done~')
      expect(scene.appendChatMessage).toHaveBeenCalledWith('assistant', 'all done~ 【 開心 】', report)
      expect(scene.setPhase).toHaveBeenCalledWith('idle')
      expect(scene.setLaidOut).not.toHaveBeenCalled()
      expect(scene.say).toHaveBeenCalledWith('all done~', expect.any(Object))
      showLastLine(scene)
      expect(scene.wear).toHaveBeenCalledWith('happy', '【 開心 】')
    })

    it('already said: nothing is written again — the line went on the record, signed, when she said it', () => {
      const scene = createScene()
      choreograph({ type: 'result', tier: 'light', line: 'all done~', mood: '【 開心 】', said: true }, scene)
      expect(scene.appendChatMessage).not.toHaveBeenCalled()
      expect(scene.setPhase).toHaveBeenCalledWith('idle')
      // Already on screen — nothing left to say.
      expect(scene.say).not.toHaveBeenCalled()
    })
  })

  describe('result: medium', () => {
    it('not already said: says it laid out, once it reaches the box', () => {
      const scene = createScene()
      choreograph({ type: 'result', tier: 'medium', line: 'a longer answer', expression: 'proud' }, scene)
      expect(scene.setPhase).toHaveBeenCalledWith('idle')
      expect(scene.say).toHaveBeenCalledWith('a longer answer', expect.any(Object))
      expect(scene.setLaidOut).not.toHaveBeenCalled()
      showLastLine(scene)
      expect(scene.wear).toHaveBeenCalledWith('proud', undefined)
      expect(scene.setLaidOut).toHaveBeenCalledWith('a longer answer')
    })

    it('already said: idle, and nothing further to say', () => {
      const scene = createScene()
      choreograph({ type: 'result', tier: 'medium', line: 'a longer answer', said: true }, scene)
      expect(scene.setPhase).toHaveBeenCalledWith('idle')
      expect(scene.say).not.toHaveBeenCalled()
      expect(scene.setLaidOut).not.toHaveBeenCalled()
    })
  })

  describe('result: heavy', () => {
    it('not already said: ends the turn at phase done, with the report, and shows the CTA once she is through saying it', () => {
      const scene = createScene()
      const report: Report = { label: 'label', body: 'body' }
      choreograph({ type: 'result', tier: 'heavy', line: 'here is what I did', report, expression: 'proud' }, scene)
      expect(scene.setPhase).toHaveBeenCalledWith('done')
      expect(scene.setReport).toHaveBeenCalledWith(report)
      expect(scene.setCtaVisible).not.toHaveBeenCalled()
      expect(scene.say).toHaveBeenCalledWith('here is what I did', expect.any(Object))
      showLastLine(scene)
      expect(scene.wear).toHaveBeenCalledWith('proud', undefined)
      expect(scene.setCtaVisible).not.toHaveBeenCalled()
      finishLastLine(scene)
      expect(scene.setCtaVisible).toHaveBeenCalledWith(true)
    })

    it('not already said, no report: falls back to null rather than undefined', () => {
      const scene = createScene()
      choreograph({ type: 'result', tier: 'heavy', line: 'here is what I did' }, scene)
      expect(scene.setReport).toHaveBeenCalledWith(null)
    })

    it('already said: ends the turn at phase done and shows the CTA immediately — nothing left to type out', () => {
      const scene = createScene()
      const report: Report = { label: 'label', body: 'body' }
      choreograph(
        { type: 'result', tier: 'heavy', line: 'here is what I did', report, mood: '【 誇らしい 】', said: true },
        scene,
      )
      expect(scene.setPhase).toHaveBeenCalledWith('done')
      expect(scene.setReport).toHaveBeenCalledWith(report)
      expect(scene.setCtaVisible).toHaveBeenCalledWith(true)
      expect(scene.say).not.toHaveBeenCalled()
      // Already on screen, and already on the record with its marker.
      expect(scene.appendChatMessage).not.toHaveBeenCalled()
    })
  })
})
