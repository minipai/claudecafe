import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readGit } from './status'

// Bare, so the fixtures — and readGit's own git calls, which inherit this
// same process's env — aren't run through whatever the developer's own
// machine has set globally. commit.gpgsign is the one that actually bites.
process.env.GIT_CONFIG_GLOBAL = '/dev/null'
process.env.GIT_CONFIG_SYSTEM = '/dev/null'

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-git-'))
}

describe('readGit', () => {
  it('is a blank status for a folder that is not a git repo at all', async () => {
    const dir = tempDir()
    expect(await readGit(dir)).toEqual({ branch: null, added: 0, removed: 0 })
  })

  it('reads the branch and the shortstat of a dirtied real repo', async () => {
    const dir = tempDir()
    execSync('git init -q -b main', { cwd: dir })
    execSync('git config user.email "maid@claudecafe.dev"', { cwd: dir })
    execSync('git config user.name "Test Maid"', { cwd: dir })
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\nthree\n')
    execSync('git add a.txt', { cwd: dir })
    execSync('git commit -q -m "first commit"', { cwd: dir })

    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\nfour\nfive\nsix\n')

    const status = await readGit(dir)
    expect(status).toEqual({ branch: 'main', added: 3, removed: 2 })
  })
})
