export function statusRows(stats) {
  const quotaLeft = stats.quota === undefined ? undefined : 100 - Math.round(stats.quota)
  const cost = stats.usd === undefined ? '' : `    $${stats.usd.toFixed(2)}`
  return [
    [{ text: stats.project, bold: true, wrap: 'truncate-start' }],
    ...(stats.branch ? [[{ text: `⎇ ${stats.branch}` }]] : []),
    [{ text: 'HP ' }, ...bar(stats.contextLeft, gaugeColor(stats.contextLeft, 'green')), { text: `  context left ${stats.contextLeft}%` }],
    [{ text: 'MP ' }, ...bar(quotaLeft ?? 0, gaugeColor(quotaLeft ?? 0, 'cyan')), { text: `  5h left ${quotaLeft === undefined ? '—' : `${quotaLeft}%`}` }],
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

function gaugeColor(left, full) {
  if (left > 50) return full
  if (left > 20) return 'yellow'
  return 'red'
}

function duration(ms) {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}
