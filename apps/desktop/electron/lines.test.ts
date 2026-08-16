import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { englishLines, knownLines, readAnswer, replyLanguage } from './lines'
import { rememberSpeech } from './history'
import type { Lines } from '../src/agent/bridge'

const ENGLISH = englishLines()

const WRITTEN: Omit<Lines, 'waiting'> & { waiting: string[] } = {
  greeting: 'ようこそ、ご主人様',
  interrupted: '止まってしまいました',
  commandAsk: 'やっていいですか？',
  editAsk: '変えてもいいですか？',
  planAsk: 'これでいいですか？',
  errorTitle: 'あちゃー',
  waiting: ['ちょっと待って', 'がんばる', 'もうすぐ', 'むずかしい', 'あとちょっと'],
}

describe('readAnswer', () => {
  it('pulls the JSON object out from between whatever prose surrounds it', () => {
    const answer = `Sure, here it is!\n\n${JSON.stringify(WRITTEN)}\n\nHope that helps!`
    expect(readAnswer(answer)).toEqual(WRITTEN)
  })

  it('falls back to the English line for any key the reply left out', () => {
    const answer = JSON.stringify({ greeting: 'Hi there~' })
    expect(readAnswer(answer)).toEqual({
      greeting: 'Hi there~',
      interrupted: ENGLISH.interrupted,
      commandAsk: ENGLISH.commandAsk,
      editAsk: ENGLISH.editAsk,
      planAsk: ENGLISH.planAsk,
      errorTitle: ENGLISH.errorTitle,
      waiting: ENGLISH.waiting,
    })
  })

  it('drops non-string and blank waiting lines, keeping the real ones', () => {
    const answer = JSON.stringify({ waiting: [123, '', '   ', 'Good one', null, 'Another'] })
    expect(readAnswer(answer)?.waiting).toEqual(['Good one', 'Another'])
  })

  it('keeps the English waiting lines when the reply gave none usable', () => {
    const answer = JSON.stringify({ greeting: 'Hi there~', waiting: ['', '   '] })
    expect(readAnswer(answer)?.waiting).toEqual(ENGLISH.waiting)
  })

  it('is null when the reply is word-for-word the English she already has', () => {
    const answer = JSON.stringify({ ...ENGLISH, waiting: undefined })
    expect(readAnswer(answer)).toBeNull()
  })

  it('is null for garbage with no JSON object in it at all', () => {
    expect(readAnswer('I cannot help with that right now.')).toBeNull()
  })

  it('is null for a JSON-shaped body that does not actually parse', () => {
    expect(readAnswer('{ "greeting": "oops missing quote and brace')).toBeNull()
  })
})

describe('knownLines', () => {
  beforeEach(() => {
    fs.rmSync(path.join(app.getPath('userData'), 'lines.json'), { force: true })
  })

  it('returns the built-in English lines without touching the file at all', () => {
    expect(knownLines('English')).toBe(ENGLISH)
    expect(knownLines('english')).toBe(ENGLISH)
    expect(knownLines('  English  ')).toBe(ENGLISH)
  })

  it('is null for a language never written', () => {
    expect(knownLines('日本語')).toBeNull()
  })

  it('treats a kept note with no waiting lines as unwritten', () => {
    fs.writeFileSync(
      path.join(app.getPath('userData'), 'lines.json'),
      JSON.stringify({ 日本語: { ...WRITTEN, waiting: [] } }),
    )
    expect(knownLines('日本語')).toBeNull()
  })

  it('returns a kept note that does have waiting lines', () => {
    fs.writeFileSync(path.join(app.getPath('userData'), 'lines.json'), JSON.stringify({ 日本語: WRITTEN }))
    expect(knownLines('日本語')).toEqual(WRITTEN)
  })
})

describe('replyLanguage', () => {
  let home: string
  const originalEnv = process.env.CLAUDE_MAID_LANG

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-home-'))
    vi.spyOn(os, 'homedir').mockReturnValue(home)
    delete process.env.CLAUDE_MAID_LANG
    fs.rmSync(path.join(app.getPath('userData'), 'speech.json'), { force: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalEnv === undefined) delete process.env.CLAUDE_MAID_LANG
    else process.env.CLAUDE_MAID_LANG = originalEnv
  })

  function writeConfig(lang: string) {
    fs.mkdirSync(path.join(home, '.claude/cafe'), { recursive: true })
    fs.writeFileSync(path.join(home, '.claude/cafe/config.json'), JSON.stringify({ lang }))
  }

  it('defaults to English when nothing says otherwise', () => {
    expect(replyLanguage()).toBe('English')
  })

  it('falls back to the café config file when nothing more specific is set', () => {
    writeConfig('Cantonese')
    expect(replyLanguage()).toBe('Cantonese')
  })

  it('prefers the CLAUDE_MAID_LANG environment override over the café config', () => {
    writeConfig('Cantonese')
    process.env.CLAUDE_MAID_LANG = 'Korean'
    expect(replyLanguage()).toBe('Korean')
  })

  it('prefers what the window itself was told over the environment and the café config', () => {
    writeConfig('Cantonese')
    process.env.CLAUDE_MAID_LANG = 'Korean'
    rememberSpeech('French')
    expect(replyLanguage()).toBe('French')
  })
})
