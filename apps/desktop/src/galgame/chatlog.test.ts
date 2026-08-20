import { describe, expect, it } from 'vitest'
import { createChatMessage, createPreviewHistory, glance, recordToolResult, shorten, signed } from './chatlog'

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

describe('glance', () => {
  it('leaves a line short enough to read at a glance alone', () => {
    expect(glance('fix the login page')).toBe('fix the login page')
  })

  it('folds a pasted block onto one line — the pill is anchored over her, and a wall of text covers her', () => {
    expect(glance('first line\n\n  second line\tthird')).toBe('first line second line third')
  })

  it('clips anything past 90 characters with an ellipsis', () => {
    const pasted = glance('x'.repeat(500))
    expect(pasted.length).toBe(89)
    expect(pasted.endsWith('…')).toBe(true)
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
