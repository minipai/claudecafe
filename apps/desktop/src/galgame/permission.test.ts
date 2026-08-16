import { describe, expect, it } from 'vitest'
import { alwaysCovers, diffLines, readPermission, standingFor } from './permission'

describe('readPermission', () => {
  it('reads ExitPlanMode into a plan ask, previewing the first two non-heading lines', () => {
    const plan = '# The Plan\n\nFirst paragraph line.\nSecond paragraph line.\nThird line, not shown.'
    const ask = readPermission('ExitPlanMode', { plan })
    expect(ask.kind).toBe('plan')
    expect(ask.standing).toBe('ExitPlanMode')
    expect(ask.canAlwaysAllow).toBe(false)
    expect(ask.expand).toBe(plan)
    expect(ask.planPreview).toBe('First paragraph line. Second paragraph line.')
  })

  it('drops heading and blank lines from the plan preview', () => {
    const plan = '# Heading one\n## Heading two\n\nOnly real line.'
    const ask = readPermission('ExitPlanMode', { plan })
    expect(ask.planPreview).toBe('Only real line.')
  })

  it('reads Edit as a diff from old_string to new_string', () => {
    const ask = readPermission('Edit', {
      file_path: '/tmp/thing.ts',
      old_string: 'before',
      new_string: 'after',
    })
    expect(ask.kind).toBe('edit')
    expect(ask.standing).toBe('Edit')
    expect(ask.title).toBe('/tmp/thing.ts')
    expect(ask.canAlwaysAllow).toBe(true)
    expect(ask.diff).toEqual({ filePath: '/tmp/thing.ts', before: 'before', after: 'after' })
  })

  it('reads Write as a diff from nothing to the whole content', () => {
    const ask = readPermission('Write', { file_path: '/tmp/new.ts', content: 'brand new file' })
    expect(ask.kind).toBe('edit')
    expect(ask.standing).toBe('Write')
    expect(ask.diff).toEqual({ filePath: '/tmp/new.ts', before: '', after: 'brand new file' })
  })

  it('reads Bash standing as the program only, not the whole command', () => {
    const ask = readPermission('Bash', { command: 'pnpm test --run', description: 'Run the tests' })
    expect(ask.kind).toBe('command')
    expect(ask.standing).toBe('Bash pnpm')
    expect(ask.title).toBe('Run the tests')
    expect(ask.command).toBe('pnpm test --run')
  })

  it('falls back to the tool name for anything else', () => {
    const ask = readPermission('SomeCustomTool', {})
    expect(ask).toMatchObject({
      kind: 'generic',
      standing: 'SomeCustomTool',
      title: 'SomeCustomTool',
      canAlwaysAllow: true,
    })
  })
})

describe('alwaysCovers / standingFor', () => {
  it('a standing "always allow" covers the exact same command only — Bash pnpm does not cover Bash rm', () => {
    const pnpm = readPermission('Bash', { command: 'pnpm test' })
    const rm = readPermission('Bash', { command: 'rm -rf node_modules' })
    const allowed = new Set([standingFor(pnpm)].filter((standing): standing is string => standing !== null))

    expect(alwaysCovers(allowed, pnpm)).toBe(true)
    expect(alwaysCovers(allowed, rm)).toBe(false)
  })

  it('Edit and Write are different standings — one does not cover the other', () => {
    const edit = readPermission('Edit', { file_path: '/tmp/a.ts', old_string: 'a', new_string: 'b' })
    const write = readPermission('Write', { file_path: '/tmp/a.ts', content: 'brand new' })
    const allowed = new Set([standingFor(edit)].filter((standing): standing is string => standing !== null))

    expect(alwaysCovers(allowed, edit)).toBe(true)
    expect(alwaysCovers(allowed, write)).toBe(false)
  })

  it('standingFor refuses an ask that can never be always-allowed — ExitPlanMode never enters the set', () => {
    const plan = readPermission('ExitPlanMode', { plan: '# The Plan' })
    expect(plan.canAlwaysAllow).toBe(false)
    expect(standingFor(plan)).toBeNull()
  })
})

describe('diffLines', () => {
  it('marks every line unchanged when the two are equal', () => {
    const rows = diffLines('a\nb\nc', 'a\nb\nc')
    expect(rows).toEqual([
      { sign: ' ', text: 'a' },
      { sign: ' ', text: 'b' },
      { sign: ' ', text: 'c' },
    ])
  })

  it('reads a pure insert as every line added — an empty before splits to one blank line, so a Write diff leads with a removed blank', () => {
    const rows = diffLines('', 'a\nb')
    expect(rows).toEqual([
      { sign: '-', text: '' },
      { sign: '+', text: 'a' },
      { sign: '+', text: 'b' },
    ])
  })

  it('reads a pure delete as every line removed, with the same blank-line artifact on the empty after', () => {
    const rows = diffLines('a\nb', '')
    expect(rows).toEqual([
      { sign: '-', text: 'a' },
      { sign: '-', text: 'b' },
      { sign: '+', text: '' },
    ])
  })

  it('has nothing in common when neither side shares a line', () => {
    const rows = diffLines('a\nb', 'x\ny')
    expect(rows).toEqual([
      { sign: '-', text: 'a' },
      { sign: '-', text: 'b' },
      { sign: '+', text: 'x' },
      { sign: '+', text: 'y' },
    ])
  })

  it('keeps the common lines of a mixed edit and marks only what changed', () => {
    const rows = diffLines('a\nb\nc', 'a\nx\nc')
    expect(rows).toEqual([
      { sign: ' ', text: 'a' },
      { sign: '-', text: 'b' },
      { sign: '+', text: 'x' },
      { sign: ' ', text: 'c' },
    ])
  })

  it('carries the trailing tail of whichever side runs longer', () => {
    const rows = diffLines('a\nb', 'a\nb\nc\nd')
    expect(rows).toEqual([
      { sign: ' ', text: 'a' },
      { sign: ' ', text: 'b' },
      { sign: '+', text: 'c' },
      { sign: '+', text: 'd' },
    ])
  })
})
