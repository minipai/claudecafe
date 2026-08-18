import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import {
  chosenLocale,
  chosenSpeech,
  conversationBacklog,
  forgetSession,
  lastBounds,
  lastConversation,
  listConversations,
  recentFolders,
  rememberBounds,
  rememberFolder,
  rememberLocale,
  rememberSession,
  rememberSpeech,
} from './history'

/** The single-value files under userData that a stray earlier test could leave
 * behind — userData is one temp folder for this whole process. */
function clearUserData() {
  for (const name of ['folders.json', 'window.json', 'locale.json', 'speech.json', 'sessions.json']) {
    fs.rmSync(path.join(app.getPath('userData'), name), { force: true })
  }
}

beforeEach(clearUserData)

function transcriptFolder(home: string, cwd: string) {
  return path.join(home, '.claude/projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'))
}

function writeTranscript(home: string, cwd: string, sessionId: string, lines: unknown[]) {
  const folder = transcriptFolder(home, cwd)
  fs.mkdirSync(folder, { recursive: true })
  fs.writeFileSync(path.join(folder, `${sessionId}.jsonl`), lines.map((line) => JSON.stringify(line)).join('\n') + '\n')
  return path.join(folder, `${sessionId}.jsonl`)
}

function userRow(content: unknown, extra: Record<string, unknown> = {}) {
  return { type: 'user', message: { content }, ...extra }
}

function assistantRow(content: unknown, extra: Record<string, unknown> = {}) {
  return { type: 'assistant', message: { content }, ...extra }
}

describe('rememberSession / lastConversation / forgetSession', () => {
  let home: string

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-home-'))
    vi.spyOn(os, 'homedir').mockReturnValue(home)
  })

  afterEach(() => vi.restoreAllMocks())

  it('round-trips a remembered session and forgets it again', () => {
    const cwd = '/Users/master/project'
    writeTranscript(home, cwd, 'sess-1', [userRow('hello there')])

    expect(lastConversation(cwd)).toBeNull()
    rememberSession(cwd, 'sess-1')
    expect(lastConversation(cwd)).toEqual({ sessionId: 'sess-1', backlog: [{ role: 'user', content: 'hello there', at: expect.any(Number) }] })

    forgetSession(cwd)
    expect(lastConversation(cwd)).toBeNull()
  })

  it('is null when the remembered transcript has since been cleared out', () => {
    const cwd = '/Users/master/gone'
    rememberSession(cwd, 'sess-missing')
    expect(lastConversation(cwd)).toBeNull()
  })
})

describe('conversationBacklog', () => {
  let home: string

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-home-'))
    vi.spyOn(os, 'homedir').mockReturnValue(home)
  })

  afterEach(() => vi.restoreAllMocks())

  it('keeps user and assistant text, drops sidechains, meta rows, tagged and language-preamble rows', () => {
    const cwd = '/Users/master/proj'
    writeTranscript(home, cwd, 'sess', [
      userRow('what do you think?'),
      assistantRow('Let me have a look~'),
      userRow('a subagent said this', { isSidechain: true }),
      userRow('hook output', { isMeta: true }),
      userRow('<local-command-stdout>ls</local-command-stdout>'),
      userRow('(Output language: English)'),
      assistantRow([{ type: 'tool_use', name: 'Read', input: { file_path: 'a.ts' } }]),
    ])
    const backlog = conversationBacklog(cwd, 'sess')
    expect(backlog).toEqual([
      { role: 'user', content: 'what do you think?', at: expect.any(Number) },
      { role: 'assistant', content: 'Let me have a look~', at: expect.any(Number) },
      { role: 'event', content: 'Read a.ts', at: expect.any(Number) },
    ])
  })

  it('marks an answer she wrote out with shape to it, so the box lays it out again instead of reading it as speech', () => {
    const cwd = '/Users/master/proj'
    const written = 'First paragraph.\n\n- one\n- two\n\nAnd **the rest** of it.'
    writeTranscript(home, cwd, 'sess', [assistantRow('Had a look~'), assistantRow(written)])
    const backlog = conversationBacklog(cwd, 'sess')
    expect(backlog).toEqual([
      { role: 'assistant', content: 'Had a look~', at: expect.any(Number) },
      { role: 'assistant', content: written, at: expect.any(Number), laidOut: true },
    ])
  })

  it('drops a slash command wrapped in <command-name>, a tag Claude Code itself writes', () => {
    const cwd = '/Users/master/proj'
    writeTranscript(home, cwd, 'sess', [userRow('<command-name>/compact</command-name>')])
    expect(conversationBacklog(cwd, 'sess')).toEqual([])
  })

  it('keeps a message that legitimately starts with a plain HTML-looking tag like <div>, since that is not one of the wrappers', () => {
    const cwd = '/Users/master/proj'
    writeTranscript(home, cwd, 'sess', [userRow('<div>this is what I actually typed</div>')])
    expect(conversationBacklog(cwd, 'sess')).toEqual([
      { role: 'user', content: '<div>this is what I actually typed</div>', at: expect.any(Number) },
    ])
  })

  it('skips broken JSON lines rather than failing the whole transcript', () => {
    const cwd = '/Users/master/broken'
    const file = writeTranscript(home, cwd, 'sess', [userRow('good line')])
    fs.appendFileSync(file, 'not json at all\n')
    fs.appendFileSync(file, JSON.stringify(userRow('also good')) + '\n')
    expect(conversationBacklog(cwd, 'sess')).toEqual([
      { role: 'user', content: 'good line', at: expect.any(Number) },
      { role: 'user', content: 'also good', at: expect.any(Number) },
    ])
  })

  it('keeps only the last 60 lines', () => {
    const cwd = '/Users/master/long'
    const rows = Array.from({ length: 70 }, (_, i) => userRow(`msg ${i}`))
    writeTranscript(home, cwd, 'sess', rows)
    const backlog = conversationBacklog(cwd, 'sess')!
    expect(backlog).toHaveLength(60)
    expect(backlog[0].content).toBe('msg 10')
    expect(backlog[59].content).toBe('msg 69')
  })

  it('brings the write-up back off the call she handed it over on — the transcript keeps no other copy of it', () => {
    const cwd = '/Users/master/proj'
    writeTranscript(home, cwd, 'sess', [
      userRow('how does the login work?'),
      assistantRow([
        {
          type: 'tool_use',
          name: 'mcp__cafe__report',
          input: { line: 'All written down~', label: 'read it →', body: '# Login\n\nit goes like this' },
        },
      ]),
    ])
    const backlog = conversationBacklog(cwd, 'sess')!
    expect(backlog[1]).toEqual({
      role: 'assistant',
      content: 'All written down~',
      at: expect.any(Number),
      report: { label: 'read it →', body: '# Login\n\nit goes like this' },
    })
  })

  it('keeps what she said out loud as the line, with the write-up hanging off it', () => {
    const cwd = '/Users/master/proj'
    writeTranscript(home, cwd, 'sess', [
      assistantRow([
        { type: 'text', text: 'Done ♪ 【 開心 (˶ˆᗜˆ˵) 】' },
        { type: 'tool_use', name: 'mcp__cafe__report', input: { line: 'All written down~', body: 'the body' } },
      ]),
    ])
    const backlog = conversationBacklog(cwd, 'sess')!
    expect(backlog[0].content).toBe('Done ♪ 【 開心 (˶ˆᗜˆ˵) 】')
    // No label of her own: the panel still needs a way in.
    expect(backlog[0].report).toEqual({ label: 'View full report →', body: 'the body' })
  })

  it('is null when the transcript file does not exist', () => {
    expect(conversationBacklog('/nowhere', 'nope')).toBeNull()
  })

  it('inherits the previous row\'s timestamp for a row with none of its own, rather than stamping it "now"', () => {
    const cwd = '/Users/master/proj'
    const stamped = '2024-01-01T00:00:00.000Z'
    writeTranscript(home, cwd, 'sess', [
      userRow('first, timestamped', { timestamp: stamped }),
      assistantRow('second, with no timestamp of its own'),
    ])
    const backlog = conversationBacklog(cwd, 'sess')!
    expect(backlog[0].at).toBe(Date.parse(stamped))
    expect(backlog[1].at).toBe(Date.parse(stamped))
  })

  it('falls back to 0, not "now", for a timestampless row with nothing said before it', () => {
    const cwd = '/Users/master/proj'
    writeTranscript(home, cwd, 'sess', [userRow('no timestamp anywhere')])
    const backlog = conversationBacklog(cwd, 'sess')!
    expect(backlog[0].at).toBe(0)
  })
})

describe('listConversations', () => {
  let home: string

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-home-'))
    vi.spyOn(os, 'homedir').mockReturnValue(home)
  })

  afterEach(() => vi.restoreAllMocks())

  it('uses the first thing the master said as the opening, cut at 120 characters', () => {
    const cwd = '/Users/master/proj'
    const long = 'a'.repeat(150)
    writeTranscript(home, cwd, 'sess-long', [userRow(long)])
    const [conversation] = listConversations(cwd)
    expect(conversation.sessionId).toBe('sess-long')
    expect(conversation.opening).toBe(`${'a'.repeat(118)}…`)
  })

  it('mangles the project folder the same way Claude Code itself does — pinned against a literal, not against the regex that produces it', () => {
    const cwd = '/Users/art/Dev/claudecafe'
    const folder = path.join(home, '.claude/projects', '-Users-art-Dev-claudecafe')
    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(path.join(folder, 'sess.jsonl'), `${JSON.stringify(userRow('hi'))}\n`)
    expect(listConversations(cwd).map((c) => c.sessionId)).toEqual(['sess'])
  })

  it('excludes a session whose first human line falls past the 256KB scanned — a known, accepted limit rather than a fixed one', () => {
    const cwd = '/Users/master/proj'
    // A single giant filler line, well past the 256KB read window, before the
    // line that would otherwise have named this session's opening.
    const filler = assistantRow('x'.repeat(300 * 1024))
    writeTranscript(home, cwd, 'buried', [filler, userRow('are you even there?')])
    expect(listConversations(cwd).map((c) => c.sessionId)).toEqual([])
  })

  it('keeps only the newest 40 conversations out of 41', () => {
    const cwd = '/Users/master/many'
    const now = Date.now() / 1000
    for (let i = 0; i < 41; i++) {
      const file = writeTranscript(home, cwd, `sess-${i}`, [userRow(`msg ${i}`)])
      fs.utimesSync(file, now - (41 - i), now - (41 - i)) // sess-0 oldest, sess-40 newest
    }
    const sessions = listConversations(cwd).map((c) => c.sessionId)
    expect(sessions).toHaveLength(40)
    expect(sessions).not.toContain('sess-0')
    expect(sessions[0]).toBe('sess-40')
  })

  it('excludes sessions where the master never said anything himself', () => {
    const cwd = '/Users/master/proj'
    writeTranscript(home, cwd, 'assistant-only', [assistantRow('a monologue')])
    writeTranscript(home, cwd, 'sidechain-only', [userRow('subagent chatter', { isSidechain: true })])
    writeTranscript(home, cwd, 'with-master', [userRow('hi')])
    expect(listConversations(cwd).map((c) => c.sessionId)).toEqual(['with-master'])
  })

  it('sorts newest first and ignores non-.jsonl files', () => {
    const cwd = '/Users/master/proj'
    const older = writeTranscript(home, cwd, 'older', [userRow('first')])
    const newer = writeTranscript(home, cwd, 'newer', [userRow('second')])
    const now = Date.now() / 1000
    fs.utimesSync(older, now - 100, now - 100)
    fs.utimesSync(newer, now, now)
    fs.writeFileSync(path.join(transcriptFolder(home, cwd), 'not-a-transcript.txt'), 'ignore me')

    expect(listConversations(cwd).map((c) => c.sessionId)).toEqual(['newer', 'older'])
  })

  it('is empty for a folder Claude Code has never been run in', () => {
    expect(listConversations('/Users/master/never-opened')).toEqual([])
  })

  it('drops a transcript that vanishes between the listing and the stamping, rather than throwing', () => {
    const cwd = '/Users/master/proj'
    const goneFile = writeTranscript(home, cwd, 'gone', [userRow('about to vanish')])
    writeTranscript(home, cwd, 'stays', [userRow('still here')])

    const real = fs.statSync
    vi.spyOn(fs, 'statSync').mockImplementation((target, ...rest) => {
      if (target === goneFile) throw new Error('ENOENT: no such file or directory')
      return real(target, ...(rest as []))
    })

    expect(listConversations(cwd).map((c) => c.sessionId)).toEqual(['stays'])
  })
})

describe('recentFolders', () => {
  let home: string

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-home-'))
    vi.spyOn(os, 'homedir').mockReturnValue(home)
  })

  afterEach(() => vi.restoreAllMocks())

  it('merges visited folders with Claude Code projects, deduped, existing only, newest project first', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-folder-a-'))
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-folder-b-'))
    const c = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-folder-c-'))
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-folder-d-'))
    const missing = path.join(os.tmpdir(), 'cafe-folder-does-not-exist')

    rememberFolder(a)
    rememberFolder(b) // b is now the most recently visited

    fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
    fs.writeFileSync(
      path.join(home, '.claude.json'),
      JSON.stringify({
        projects: {
          [c]: { lastStartTime: '2024-01-01T00:00:00Z' },
          [d]: { lastStartTime: '2024-06-01T00:00:00Z' },
          [a]: { lastStartTime: '2024-12-01T00:00:00Z' }, // already visited: not duplicated
          [missing]: { lastStartTime: '2024-12-31T00:00:00Z' }, // gone from disk: dropped
        },
      }),
    )

    expect(recentFolders()).toEqual([b, a, d, c])
  })

  it('is just the visited list when Claude Code has no project notes of its own', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-folder-a-'))
    rememberFolder(a)
    expect(recentFolders()).toEqual([a])
  })

  it('keeps only the 20 most recently visited folders out of 25', () => {
    const folders = Array.from({ length: 25 }, () => fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-folder-')))
    for (const folder of folders) rememberFolder(folder)

    const visited = recentFolders()
    expect(visited).toHaveLength(20)
    // Newest remembered first; the oldest five have fallen off the back.
    expect(visited).toEqual([...folders].reverse().slice(0, 20))
  })
})

describe('rememberBounds / lastBounds', () => {
  it('is null before anything has been remembered', () => {
    expect(lastBounds()).toBeNull()
  })

  it('round-trips a window rectangle', () => {
    const bounds = { x: 10, y: 20, width: 800, height: 600 }
    rememberBounds(bounds)
    expect(lastBounds()).toEqual(bounds)
  })

  it('rejects a saved rectangle with non-numeric sides', () => {
    fs.writeFileSync(path.join(app.getPath('userData'), 'window.json'), JSON.stringify({ x: 0, y: 0, width: 'wide', height: 600 }))
    expect(lastBounds()).toBeNull()
  })
})

describe('chosenLocale / rememberLocale', () => {
  it('defaults to system', () => {
    expect(chosenLocale()).toBe('system')
  })

  it('round-trips a chosen locale', () => {
    rememberLocale('zh-TW')
    expect(chosenLocale()).toBe('zh-TW')
  })
})

describe('chosenSpeech / rememberSpeech', () => {
  it('defaults to empty, leaving speech to the café setting', () => {
    expect(chosenSpeech()).toBe('')
  })

  it('round-trips a chosen speech language', () => {
    rememberSpeech('Japanese')
    expect(chosenSpeech()).toBe('Japanese')
  })
})
