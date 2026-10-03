import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contextHook } from './context'

vi.mock('node:fs/promises', () => ({ default: { readFile: vi.fn() } }))
vi.mock('./cafehome', () => ({ cafeRoot: () => '/test/cafe' }))
vi.mock('./lines', () => ({ replyLanguage: () => 'Japanese' }))

const templates = {
  greeting: readFileSync(new URL('../../../../packages/persona-panel/prompts/greeting.md', import.meta.url), 'utf8'),
  cues: readFileSync(new URL('../../../../packages/persona-panel/prompts/cues.md', import.meta.url), 'utf8'),
}
let config: Record<string, unknown>

beforeEach(() => {
  config = {}
  vi.mocked(fs.readFile).mockImplementation(async (file) => {
    const name = String(file)
    if (name === '/test/cafe/config.json') return JSON.stringify(config)
    if (name.endsWith('/prompts/greeting.md')) return templates.greeting
    if (name.endsWith('/prompts/cues.md')) return templates.cues
    throw new Error(`Unexpected read: ${name}`)
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Melbourne｜Sunny 18°C｜sunrise 06:30:00, sunset 18:00:00')))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const input = {
  hook_event_name: 'UserPromptSubmit' as const,
  session_id: 'test',
  transcript_path: '/test/transcript',
  cwd: '', // no project means no Git lookup
  prompt: 'hello',
}
const options = { signal: new AbortController().signal }

describe('desktop shared context hook', () => {
  it('adds the plugin mood and greeting once, then time context on later turns', async () => {
    const hook = contextHook()
    const first = await hook(input, undefined, options)
    expect(first).toMatchObject({ hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: expect.stringContaining('End every reply with a mood marker'),
    } })
    const firstText = JSON.stringify(first)
    expect(firstText).toContain('one short phrase in Japanese')
    expect(firstText).toContain('Melbourne｜Sunny 18°C｜sunrise 06:30, sunset 18:00')
    expect(firstText).toContain('Current time:')

    const second = await hook(input, undefined, options)
    expect(JSON.stringify(second)).toContain('Current time:')
    expect(JSON.stringify(second)).not.toContain('End every reply with a mood marker')
    expect(fetch).toHaveBeenCalledTimes(1)

    const reconnected = await contextHook()(input, undefined, options)
    expect(JSON.stringify(reconnected)).toContain('End every reply with a mood marker')
  })

  it('honours the shared ambient_context setting without fetching weather, keeping the mood marker', async () => {
    config = { ambient_context: false }
    const output = await contextHook()(input, undefined, options)
    expect(JSON.stringify(output)).not.toContain('Current time:')
    expect(JSON.stringify(output)).toContain('End every reply with a mood marker')
    expect(fetch).not.toHaveBeenCalled()
  })
})
