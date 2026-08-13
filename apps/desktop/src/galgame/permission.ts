import { editAskLine, permissionAskLine, planAskLine } from './content'

export type PermissionKind = 'plan' | 'edit' | 'command' | 'generic'

/**
 * A tool permission request, read into everything the UI needs to show it.
 * Plan approval comes through the same callback as any other tool — plan mode
 * just means the model asks via ExitPlanMode before it is allowed to work.
 */
export type PermissionAsk = {
  kind: PermissionKind
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
      title: 'Plan ready for review',
      askLine: planAskLine(),
      allowLabel: 'Start working',
      denyLabel: 'Keep planning',
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
      title: filePath,
      askLine: editAskLine(filePath),
      allowLabel: 'Allow',
      denyLabel: 'Deny',
      canAlwaysAllow: true,
      diff: { filePath, before, after },
    }
  }

  if (toolName === 'Bash') {
    const command = String(input.command ?? '')
    return {
      kind: 'command',
      title: String(input.description ?? 'Run a command'),
      askLine: permissionAskLine(command),
      allowLabel: 'Allow',
      denyLabel: 'Deny',
      canAlwaysAllow: true,
      command,
    }
  }

  return {
    kind: 'generic',
    title: toolName,
    askLine: permissionAskLine(toolName),
    allowLabel: 'Allow',
    denyLabel: 'Deny',
    canAlwaysAllow: true,
  }
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
