import { lines } from './content'
import { text } from '@/i18n'

export type PermissionKind = 'plan' | 'edit' | 'command' | 'generic'

/**
 * A tool permission request, read into everything the UI needs to show it.
 * Plan approval comes through the same callback as any other tool — plan mode
 * just means the model asks via ExitPlanMode before it is allowed to work.
 */
export type PermissionAsk = {
  kind: PermissionKind
  /** What a standing "allow" covers. The tool by name, and for a command the
   * program it runs — saying yes to `git status` once is not saying yes to
   * every command she will ever think of. */
  standing: string
  title: string
  /** What ことね says while she waits for an answer. */
  askLine: string
  allowLabel: string
  denyLabel: string
  canAlwaysAllow: boolean
  /** Long-form body for the big panel, as markdown. Absent when the preview is the whole story. */
  expand?: string
  command?: string
  diff?: { filePath: string; before: string; after: string }
  planPreview?: string
}

function firstParagraph(markdown: string) {
  return markdown
    .split('\n')
    .filter((row) => row.trim() && !row.startsWith('#'))
    .slice(0, 2)
    .join(' ')
}

export function readPermission(toolName: string, input: Record<string, unknown>): PermissionAsk {
  if (toolName === 'ExitPlanMode') {
    const plan = String(input.plan ?? '')
    return {
      kind: 'plan',
      standing: 'ExitPlanMode',
      title: text().ask.planTitle,
      askLine: lines().planAsk,
      allowLabel: text().ask.startWorking,
      denyLabel: text().ask.keepPlanning,
      canAlwaysAllow: false,
      expand: plan,
      planPreview: firstParagraph(plan),
    }
  }

  if (toolName === 'Edit' || toolName === 'Write') {
    const filePath = String(input.file_path ?? '')
    // Edit swaps one passage for another; Write hands over a whole file, so
    // everything in it counts as added.
    const before = String(input.old_string ?? '')
    const after = String(toolName === 'Write' ? (input.content ?? '') : (input.new_string ?? ''))
    return {
      kind: 'edit',
      standing: toolName,
      title: filePath,
      askLine: lines().editAsk,
      allowLabel: text().ask.allow,
      denyLabel: text().ask.deny,
      canAlwaysAllow: true,
      diff: { filePath, before, after },
    }
  }

  if (toolName === 'Bash') {
    const command = String(input.command ?? '')
    return {
      kind: 'command',
      standing: `Bash ${command.trim().split(/\s+/)[0] ?? ''}`.trim(),
      title: String(input.description ?? text().ask.runCommand),
      askLine: lines().commandAsk,
      allowLabel: text().ask.allow,
      denyLabel: text().ask.deny,
      canAlwaysAllow: true,
      command,
    }
  }

  return {
    kind: 'generic',
    standing: toolName,
    title: toolName,
    askLine: lines().commandAsk,
    allowLabel: text().ask.allow,
    denyLabel: text().ask.deny,
    canAlwaysAllow: true,
  }
}

/**
 * What he has already said yes to for good, read against a fresh ask — the
 * one irreversible decision in the app, so it is worth being exact about.
 * `Bash pnpm test` and `Bash rm -rf` are both "Bash", but never the same
 * standing: `readPermission` names the program, not the tool, for exactly
 * this. Edit and Write are kept apart the same way — a yes to swapping a
 * passage is not a yes to overwriting the whole file.
 */
export function alwaysCovers(standing: ReadonlySet<string>, ask: PermissionAsk): boolean {
  return standing.has(ask.standing)
}

/** What to remember an "always allow" as — nothing, for an ask that was never
 * offered the button in the first place. A plan she has not been let out of
 * yet is answered once and asked again every time, whatever calls this. */
export function standingFor(ask: PermissionAsk): string | null {
  return ask.canAlwaysAllow ? ask.standing : null
}

type DiffRow = { sign: ' ' | '+' | '-'; text: string }

/** Line diff, longest-common-subsequence style — small enough to keep in-house. */
export function diffLines(before: string, after: string): DiffRow[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ sign: ' ', text: a[i] })
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      rows.push({ sign: '-', text: a[i] })
      i++
    } else {
      rows.push({ sign: '+', text: b[j] })
      j++
    }
  }
  while (i < a.length) rows.push({ sign: '-', text: a[i++] })
  while (j < b.length) rows.push({ sign: '+', text: b[j++] })
  return rows
}
