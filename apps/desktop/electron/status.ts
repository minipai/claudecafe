import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SessionStatus } from '../src/agent/bridge'

const run = promisify(execFile)

async function git(cwd: string, args: string[]) {
  const { stdout } = await run('git', args, { cwd })
  return stdout.trim()
}

/** What the status line says about the folder. Not a repo, no problem — the
 * line just drops the parts it cannot know. */
export async function readGit(cwd: string): Promise<Partial<SessionStatus>> {
  try {
    const branch = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const shortstat = await git(cwd, ['diff', '--shortstat', 'HEAD'])
    return {
      branch,
      added: Number(shortstat.match(/(\d+) insertion/)?.[1] ?? 0),
      removed: Number(shortstat.match(/(\d+) deletion/)?.[1] ?? 0),
    }
  } catch {
    return { branch: null, added: 0, removed: 0 }
  }
}
