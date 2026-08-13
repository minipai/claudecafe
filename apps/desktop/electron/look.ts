import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Look } from '../src/agent/types'

/**
 * The café plugin re-shoots the maid's "look" after every piece of work — a
 * scene and a line, written to look.txt in the session's own state folder by a
 * background job the Stop hook kicks off. That hook runs for this window's
 * session too (the SDK reads the same user settings), so the window has nothing
 * to generate: it watches the file and shows whatever lands in it.
 *
 * The file may not exist yet — nothing is shot until the first turn ends, and
 * the whole thing is off unless the plugin's `look` setting is on — so this
 * polls the path rather than the folder.
 */
export function watchLook(sessionId: string, onLook: (look: Look) => void) {
  const file = path.join(os.homedir(), '.claude/cafe/sessions', sessionId, 'look.txt')
  let last = ''

  const reread = () => {
    let raw: string
    try {
      raw = fs.readFileSync(file, 'utf8')
    } catch {
      return // not shot yet
    }
    if (raw === last) return
    last = raw

    const [scene, dialogue = ''] = raw.split('\n').map((line) => line.trim()).filter(Boolean)
    if (scene) onLook({ scene, dialogue })
  }

  fs.watchFile(file, { interval: 2000 }, reread)
  reread()
  return () => fs.unwatchFile(file, reread)
}
