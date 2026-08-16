import { describe, expect, it } from 'vitest'
import { createChatMessage, createPreviewHistory, recordToolResult, shorten, signed, signLastMood } from './chatlog'

describe('createChatMessage', () => {
  it('assigns increasing ids', () => {
    const first = createChatMessage('user', 'hello')
    const second = createChatMessage('user', 'world')
    expect(second.id).toBe(first.id + 1)
  })

  it('carries role, content, report and detail through', () => {
    const report = { label: 'Report', body: 'the body' }
    const message = createChatMessage('assistant', 'said this', report, 123, 'the detail')
    expect(message).toMatchObject({
      role: 'assistant',
      content: 'said this',
      report,
      detail: 'the detail',
      createdAt: 123,
    })
  })

  it('defaults createdAt to now when not given', () => {
    const before = Date.now()
    const message = createChatMessage('user', 'hi')
    expect(message.createdAt).toBeGreaterThanOrEqual(before)
  })
})

describe('shorten', () => {
  it('leaves a short line untouched', () => {
    expect(shorten('a short line')).toBe('a short line')
  })

  it('clips anything past 160 characters with an ellipsis', () => {
    const long = 'x'.repeat(200)
    const short = shorten(long)
    expect(short.length).toBe(159)
    expect(short.endsWith('…')).toBe(true)
    expect(short.startsWith('x'.repeat(158))).toBe(true)
  })

  it('leaves a line exactly at the limit untouched', () => {
    const exact = 'x'.repeat(160)
    expect(shorten(exact)).toBe(exact)
  })
})

describe('signed', () => {
  it('appends the mood marker with a space', () => {
    expect(signed('Done ♪', '【 開心 】')).toBe('Done ♪ 【 開心 】')
  })

  it('returns the line as-is when there is no mood', () => {
    expect(signed('Done ♪')).toBe('Done ♪')
    expect(signed('Done ♪', undefined)).toBe('Done ♪')
  })
})

describe('createPreviewHistory', () => {
  it('opens with the given greeting as the first assistant line', () => {
    const history = createPreviewHistory('hello there')
    expect(history[0]).toMatchObject({ role: 'assistant', content: 'hello there' })
  })

  it('alternates user and assistant turns, oldest first', () => {
    const history = createPreviewHistory('hi')
    expect(history.map((m) => m.role)).toEqual(['assistant', 'user', 'assistant', 'user', 'assistant'])
    for (let i = 1; i < history.length; i++) {
      expect(history[i].createdAt).toBeGreaterThan(history[i - 1].createdAt)
    }
  })
})

describe('signLastMood', () => {
  it('does nothing when there is no mood to sign with', () => {
    const messages = [createChatMessage('assistant', 'said this')]
    expect(signLastMood(messages)).toBe(messages)
  })

  it('signs the most recent assistant message', () => {
    const messages = [
      createChatMessage('assistant', 'first'),
      createChatMessage('user', 'and?'),
      createChatMessage('assistant', 'second'),
    ]
    const signedMessages = signLastMood(messages, '【 開心 】')
    expect(signedMessages[2].content).toBe('second 【 開心 】')
    // Untouched otherwise.
    expect(signedMessages[0].content).toBe('first')
    expect(signedMessages[1].content).toBe('and?')
  })

  it('skips past trailing non-assistant rows to find the last thing she said', () => {
    const messages = [
      createChatMessage('assistant', 'said this'),
      createChatMessage('event', 'ran a tool'),
      createChatMessage('user', 'ok'),
    ]
    const signedMessages = signLastMood(messages, '【 開心 】')
    expect(signedMessages[0].content).toBe('said this 【 開心 】')
  })

  it('leaves the log untouched when there is no assistant message at all', () => {
    const messages = [createChatMessage('user', 'hello'), createChatMessage('event', 'ran a tool')]
    expect(signLastMood(messages, '【 開心 】')).toBe(messages)
  })

  it('does not mutate the input array', () => {
    const messages = [createChatMessage('assistant', 'said this')]
    const original = messages[0]
    signLastMood(messages, '【 開心 】')
    expect(messages[0]).toBe(original)
  })
})

describe('recordToolResult', () => {
  it('attaches the output to the matching tool row', () => {
    const messages = [
      { ...createChatMessage('event', 'ran a thing'), toolId: 'call-1' },
      { ...createChatMessage('event', 'ran another'), toolId: 'call-2' },
    ]
    const withResult = recordToolResult(messages, 'call-1', 'the output', false)
    expect(withResult[0]).toMatchObject({ output: 'the output', failed: false })
    expect(withResult[1]).not.toHaveProperty('output')
  })

  it('marks a failure', () => {
    const messages = [{ ...createChatMessage('event', 'ran a thing'), toolId: 'call-1' }]
    const withResult = recordToolResult(messages, 'call-1', 'it broke', true)
    expect(withResult[0].failed).toBe(true)
  })

  it('finds the most recent row with that id when a tool is called more than once', () => {
    const messages = [
      { ...createChatMessage('event', 'first call'), toolId: 'call-1' },
      { ...createChatMessage('event', 'second call'), toolId: 'call-1' },
    ]
    const withResult = recordToolResult(messages, 'call-1', 'second output', false)
    expect(withResult[0]).not.toHaveProperty('output')
    expect(withResult[1].output).toBe('second output')
  })

  it('leaves the log untouched when the tool id is not on the record', () => {
    const messages = [{ ...createChatMessage('event', 'ran a thing'), toolId: 'call-1' }]
    expect(recordToolResult(messages, 'no-such-call', 'output', false)).toBe(messages)
  })
})
