import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Just enough of the electron module for the main-process code to run under
 * vitest. `userData` lands in a fresh temp folder per process, so tests that
 * write history files never touch the real app's drawer — and never each other,
 * since vitest gives every test file its own process by default.
 */
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-test-'))

// vitest keeps this process alive for the whole file's run rather than
// exiting after the last test, so nothing else ever gets the chance to clean
// this folder up — take the exit itself as the cue.
process.once('exit', () => fs.rmSync(userData, { recursive: true, force: true }))

export const app = {
  getPath: (name: string) => {
    if (name === 'userData') return userData
    throw new Error(`electron stub: no path for ${name}`)
  },
  getName: () => 'ClaudeCafe (test)',
  isPackaged: false,
}
