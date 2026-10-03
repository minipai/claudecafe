export function statusRows(stats) {
  const quotaLeft = stats.quota === undefined ? undefined : 100 - Math.round(stats.quota)
  return [
    [{ text: stats.project, bold: true, wrap: 'truncate-start' }],
    [{ text: `◆ ${stats.model}` }],
    [{ text: 'HP ' }, ...bar(stats.contextLeft, gaugeColor(stats.contextLeft, 'green')), { text: `  context left ${stats.contextLeft}%` }],
    [{ text: 'MP ' }, ...bar(quotaLeft ?? 0, gaugeColor(quotaLeft ?? 0, 'cyan')), { text: `  5h left ${quotaLeft === undefined ? '—' : `${quotaLeft}%`}` }],
    ...(stats.branch ? [[{ text: `⎇ ${stats.branch}` }, ...changes(stats.changes)]] : []),
  ]
}

export function homePath(path, home) {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path
}

function changes(diff) {
  if (!diff) return []
  return [
    { text: ' (' },
    { text: `+${diff.added}`, color: 'green' },
    { text: ',' },
    { text: `-${diff.removed}`, color: 'red' },
    { text: ')' },
  ]
}

function bar(percent, color) {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)))
  return [{ text: '█'.repeat(filled), color }, { text: '░'.repeat(10 - filled), dimColor: true }]
}

function gaugeColor(left, full) {
  if (left > 50) return full
  if (left > 20) return 'yellow'
  return 'red'
}
