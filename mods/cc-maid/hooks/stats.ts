/**
 * The shift's figures, drawn above her portrait as a game's status block:
 * where she works, then HP for the context window still free and MP for the
 * five-hour limit spent.
 */
export type Stats = {
  project: string
  branch: string
  contextLeft: number
  quota?: number
  shiftMs: number
  usd?: number
}

export type Segment = { text: string; color?: string; dimColor?: boolean; bold?: boolean; wrap?: 'truncate-start' }

export function statusRows(stats: Stats): Segment[][] {
  const quota = stats.quota === undefined ? '—' : `${Math.round(stats.quota)}%`
  const cost = stats.usd === undefined ? '' : `    $${stats.usd.toFixed(2)}`
  return [
    [{ text: stats.project, bold: true, wrap: 'truncate-start' }],
    ...(stats.branch ? [[{ text: `⎇ ${stats.branch}` }]] : []),
    [{ text: 'HP ' }, ...bar(stats.contextLeft, hpColor(stats.contextLeft)), { text: `  context left ${stats.contextLeft}%` }],
    [{ text: 'MP ' }, ...bar(stats.quota ?? 0, 'cyan'), { text: `  5h used ${quota}` }],
    [{ text: `⏱ on shift ${duration(stats.shiftMs)}${cost}` }],
  ]
}

/** A path under the home directory reads from `~`. */
export function homePath(path: string, home: string | undefined): string {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path
}

function bar(percent: number, color: string): Segment[] {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)))
  return [{ text: '█'.repeat(filled), color }, { text: '░'.repeat(10 - filled), dimColor: true }]
}

function hpColor(left: number): string {
  if (left > 50) return 'green'
  if (left > 20) return 'yellow'
  return 'red'
}

function duration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}
