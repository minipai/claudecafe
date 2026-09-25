export function statusRows(stats) {
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

export function homePath(path, home) {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path
}

function bar(percent, color) {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)))
  return [{ text: '█'.repeat(filled), color }, { text: '░'.repeat(10 - filled), dimColor: true }]
}

function hpColor(left) {
  if (left > 50) return 'green'
  if (left > 20) return 'yellow'
  return 'red'
}

function duration(ms) {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}
