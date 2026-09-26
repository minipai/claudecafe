import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

/**
 * The window runs on the Claude Code the master already has, not a copy of its
 * own: he has to install and sign in to it anyway, and it keeps itself up to
 * date, where a bundled one would be a quarter of a gigabyte that is stale by
 * the next week.
 */
export type ClaudeCode =
  | { found: true; path: string; version: string }
  | { found: false; reason: 'no-claude' | 'old-claude'; detail: string }

/** Where the official installer, Homebrew and npm put `claude`. An app opened
 * from the Finder does not get his shell's PATH, so these are looked at first
 * and his login shell is only asked when none of them has it. */
const PLACES = [
  path.join(os.homedir(), '.local/bin/claude'),
  path.join(os.homedir(), '.claude/local/claude'),
  '/opt/homebrew/bin/claude',
  '/usr/local/bin/claude',
]

export function findClaudeCode(): ClaudeCode {
  const wanted = requiredVersion()
  const found = [...PLACES, fromLoginShell()].find((place) => place && isExecutable(place))
  if (!found) {
    return { found: false, reason: 'no-claude', detail: `No claude executable in ${PLACES.join(', ')} or on the login shell's PATH.` }
  }
  const version = versionOf(found)
  if (!version || olderThan(version, wanted)) {
    return {
      found: false,
      reason: 'old-claude',
      detail: `${found} is Claude Code ${version ?? '(unknown version)'}; this window needs ${wanted} or newer.`,
    }
  }
  return { found: true, path: found, version }
}

/** The Claude Code the Agent SDK was released against: the oldest it can drive. */
function requiredVersion(): string {
  const require = createRequire(import.meta.url)
  const sdk = path.dirname(require.resolve('@anthropic-ai/claude-agent-sdk'))
  return JSON.parse(fs.readFileSync(path.join(sdk, 'package.json'), 'utf8')).claudeCodeVersion
}

function fromLoginShell(): string | null {
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    return execFileSync(shell, ['-lc', 'command -v claude'], { encoding: 'utf8', timeout: 5000 }).trim() || null
  } catch {
    return null // not on his PATH either
  }
}

function isExecutable(file: string) {
  try {
    fs.accessSync(file, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function versionOf(file: string): string | null {
  try {
    const said = execFileSync(file, ['--version'], { encoding: 'utf8', timeout: 10_000 })
    return /\d+\.\d+\.\d+/.exec(said)?.[0] ?? null
  } catch {
    return null
  }
}

export function olderThan(version: string, wanted: string) {
  const [a, b] = [version, wanted].map((each) => each.split('.').map(Number))
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] < b[index]
  }
  return false
}
