import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { watchLook } from './look'

describe('watchLook', () => {
  let home: string
  let fastTimers: ReturnType<typeof setInterval>[]

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-home-'))
    vi.spyOn(os, 'homedir').mockReturnValue(home)
    fastTimers = []
  })

  afterEach(() => {
    for (const timer of fastTimers.splice(0)) clearInterval(timer)
    vi.restoreAllMocks()
  })

  function lookFile(sessionId: string) {
    return path.join(home, '.claude/cafe/sessions', sessionId, 'look.txt')
  }

  /**
   * look.ts polls on a hard-coded 2s interval, and this territory doesn't
   * touch look.ts itself — so rather than wait on it, `fs.watchFile` is swapped
   * for a stand-in that drives the exact same listener look.ts registered, at
   * a fraction of the interval. What fires the listener is beside the point:
   * watchLook's own `reread`, under test here, is what decides whether a tick
   * turns into a callback.
   */
  function fastenWatchFile() {
    vi.spyOn(fs, 'watchFile').mockImplementation(((_file: unknown, _options: unknown, listener: () => void) => {
      fastTimers.push(setInterval(listener, 10))
    }) as unknown as typeof fs.watchFile)
    vi.spyOn(fs, 'unwatchFile').mockImplementation((() => {
      for (const timer of fastTimers.splice(0)) clearInterval(timer)
    }) as unknown as typeof fs.unwatchFile)
  }

  it('fires once from the initial reread when the file already has a scene and line', () => {
    const sessionId = 'sess-1'
    fs.mkdirSync(path.dirname(lookFile(sessionId)), { recursive: true })
    fs.writeFileSync(lookFile(sessionId), 'She looks up from the keyboard.\nAlmost there~\n')

    const seen: unknown[] = []
    const stop = watchLook(sessionId, (look) => seen.push(look))

    expect(seen).toEqual([{ scene: 'She looks up from the keyboard.', dialogue: 'Almost there~' }])
    stop()
  })

  it('does not call back when the file is missing', () => {
    const seen: unknown[] = []
    const stop = watchLook('never-shot', (look) => seen.push(look))
    expect(seen).toEqual([])
    stop()
  })

  it('does not call back when the file is blank', () => {
    const sessionId = 'sess-blank'
    fs.mkdirSync(path.dirname(lookFile(sessionId)), { recursive: true })
    fs.writeFileSync(lookFile(sessionId), '\n')

    const seen: unknown[] = []
    const stop = watchLook(sessionId, (look) => seen.push(look))
    expect(seen).toEqual([])
    stop()
  })

  it('fires once when the file appears after the watch has already started', async () => {
    fastenWatchFile()
    const sessionId = 'sess-appears'
    const seen: unknown[] = []
    const stop = watchLook(sessionId, (look) => seen.push(look))
    expect(seen).toEqual([]) // nothing shot yet at the moment the watch starts

    fs.mkdirSync(path.dirname(lookFile(sessionId)), { recursive: true })
    fs.writeFileSync(lookFile(sessionId), 'She glances over.\nAlmost~\n')

    await vi.waitFor(() => expect(seen).toHaveLength(1))
    expect(seen).toEqual([{ scene: 'She glances over.', dialogue: 'Almost~' }])
    stop()
  })

  it('does not fire again when the file is rewritten with identical contents', async () => {
    fastenWatchFile()
    const sessionId = 'sess-identical'
    fs.mkdirSync(path.dirname(lookFile(sessionId)), { recursive: true })
    const content = 'She waits.\nStill working~\n'
    fs.writeFileSync(lookFile(sessionId), content)

    const seen: unknown[] = []
    const stop = watchLook(sessionId, (look) => seen.push(look))
    expect(seen).toHaveLength(1) // the initial synchronous reread

    fs.writeFileSync(lookFile(sessionId), content)
    // A handful of fast ticks with nothing new appearing is the closest a
    // negative assertion gets to "polled, not slept" — there is no later
    // state to wait for, only the absence of one.
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(seen).toHaveLength(1)
    stop()
  })

  it('fires again when the contents actually change', async () => {
    fastenWatchFile()
    const sessionId = 'sess-changed'
    fs.mkdirSync(path.dirname(lookFile(sessionId)), { recursive: true })
    fs.writeFileSync(lookFile(sessionId), 'She waits.\nStill working~\n')

    const seen: unknown[] = []
    const stop = watchLook(sessionId, (look) => seen.push(look))
    expect(seen).toHaveLength(1)

    fs.writeFileSync(lookFile(sessionId), 'She looks up.\nDone!\n')
    await vi.waitFor(() => expect(seen).toHaveLength(2))
    expect(seen[1]).toEqual({ scene: 'She looks up.', dialogue: 'Done!' })
    stop()
  })

  it('calls back no more once stopped', async () => {
    fastenWatchFile()
    const sessionId = 'sess-stopped'
    fs.mkdirSync(path.dirname(lookFile(sessionId)), { recursive: true })
    fs.writeFileSync(lookFile(sessionId), 'She waits.\nStill working~\n')

    const seen: unknown[] = []
    const stop = watchLook(sessionId, (look) => seen.push(look))
    expect(seen).toHaveLength(1)
    stop()

    fs.writeFileSync(lookFile(sessionId), 'She looks up.\nDone!\n')
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(seen).toHaveLength(1)
  })
})
