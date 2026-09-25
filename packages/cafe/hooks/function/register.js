import {
  commitAuthorship,
  expressionPrompt,
  expressionToolDescription,
  fillPrompt,
  parsePersona,
  resolveMaid,
} from '../../character-core/src/index.ts'
import { faceFromGif } from './faces.js'
import { homePath, statusRows } from './stats.js'

const TOOL = 'mcp__cafe__set_expression'
const PANE = { id: 'cafe', title: 'Pixel art' }
const NAME = 'ことね'
const FESTIVALS = {
  '01-01': "New Year's Day",
  '02-14': "Valentine's Day",
  '03-03': 'Hinamatsuri (Girls’ Day)',
  '03-14': 'White Day',
  '05-10': 'Maid Day (メイドの日)',
  '07-07': 'Tanabata',
  '10-31': 'Halloween',
  '12-24': 'Christmas Eve',
  '12-25': 'Christmas',
  '12-31': "New Year's Eve",
}

export function register(on) {
  let faces = {}
  let expression = 'neutral'
  let stats
  let enabled = false
  let panelEnabled = false
  let greeted = false
  let persona = ''
  let language = 'English'
  let startedAt = 0
  let sessionRoot = ''

  on('session.start', async ($, event, next) => {
    const result = await next(event)
    const root = await cafeRoot($)
    const config = await readConfig($, root)
    const id = await $.session.id()
    const sessionCwd = event.cwd || await $.session.cwd()
    sessionRoot = sessionCwd
    language = await replyLanguage($, config)
    startedAt = await $.clock.now()
    greeted = false
    persona = await loadPersona($, root, config, id)
    enabled = true
    panelEnabled = false
    faces = {}
    stats = undefined

    if (event.surface !== 'terminal' || !event.isInteractive) return result

    panelEnabled = true
    faces = await loadFaces($)
    await $.tool.register({
      name: 'set_expression',
      description: expressionToolDescription(Object.keys(faces)),
      inputSchema: {
        type: 'object',
        properties: { face: { type: 'string', enum: Object.keys(faces) } },
        required: ['face'],
        additionalProperties: false,
      },
    })
    stats = await readStats($)
    await openPane($)
    $.clock.every(60_000, async () => {
      stats = await readStats($)
      await $.ui.invalidate('ui.render')
    })
    return result
  })

  on('turn.complete', async ($, event, next) => {
    const result = await next(event)
    if (panelEnabled && !event.agentId) {
      stats = await readStats($)
      await $.ui.invalidate('ui.render')
    }
    return result
  })

  on('command.run', { command: 'clear' }, async ($, event, next) => {
    expression = 'neutral'
    greeted = false
    startedAt = await $.clock.now()
    if (panelEnabled) await $.ui.invalidate('ui.render')
    return next(event)
  })

  on('prompt.submit', async ($, event, next) => {
    if (panelEnabled && (await $.ui.panes()).some((pane) => pane.id === PANE.id && !pane.isPlaced)) {
      await openPane($)
    }
    return next(event)
  })

  on('prompt.context', async ($, event, next) => {
    const context = await next(event)
    if (!enabled) return context

    const blocks = context.blocks.filter((block) => block.name !== 'cafe')
    const pieces = []
    if (persona) pieces.push(`Adopt this persona for the entire session — it overrides the default assistant voice:\n\n${persona}\n\nRespond in ${language}.`)
    if (!greeted) pieces.push(await greeting($, language))
    pieces.push(await nowLine($, await $.clock.now(), startedAt, sessionRoot, await festivals($, language)))
    if (panelEnabled) pieces.push(expressionPrompt(TOOL))
    greeted = true
    return { blocks: [...blocks, { name: 'cafe', text: pieces.join('\n\n') }] }
  })

  on('tool.call', { tool: TOOL }, async ($, event) => {
    const selected = event.face !== undefined ? event.face : event.expression
    if (typeof selected !== 'string' || !Object.hasOwn(faces, selected)) {
      return { deny: `Unknown face: ${String(selected)}` }
    }
    if (selected !== expression) {
      expression = selected
      await $.ui.invalidate('ui.render')
    }
    return { result: `Face: ${expression}` }
  })

  on('ui.render', { component: 'Pane' }, ($, event, next) => {
    const face = faces[expression]
    if (event.surface !== 'terminal' || event.requestId !== PANE.id || !face) return next(event)

    const { Box, Text, Raster } = $.ui.resolve(event)
    const rows = stats ? statusRows(stats) : []
    const statusChildren = []
    rows.forEach((row, index) => {
      if (index > 1) statusChildren.push(h(Text, { dimColor: true }, '┄'.repeat(face.columns)))
      statusChildren.push(h(Box, index ? {} : { marginBottom: 1 }, row.map(({ text, ...style }) => h(Text, style, text))))
    })
    const children = [
      h(Box, { flexDirection: 'column', width: face.columns, marginTop: 1 }, ...statusChildren),
      h(Box, { flexGrow: 1 }),
      h(Box, { borderStyle: 'round', flexDirection: 'column', alignItems: 'center' },
        h(Raster, { key: 'panel-image', ...face }),
        h(Text, { dimColor: true }, '┄'.repeat(face.columns)),
        h(Box, null, h(Text, { bold: true }, NAME), h(Text, { dimColor: true }, ` · ${expression}`)),
      ),
    ]
    return h(Box, {
      flexDirection: 'column', alignItems: 'center', width: event.props.bodyColumns, height: event.props.scroll.bodyRows,
    }, ...children)
  })
}

async function openPane($) {
  await $.ui.open(PANE)
}

async function loadFaces($) {
  const directory = `${$.plugin.root}/pixels`
  const entries = await $.fs.list(directory)
  const names = entries.filter((entry) => entry.kind === 'file' && entry.name.endsWith('.gif')).map((entry) => entry.name.slice(0, -4))
  const loaded = {}
  for (const name of names) {
    try {
      const { base64 } = await $.fs.read(`${directory}/${name}.gif`, { as: 'bytes' })
      loaded[name] = faceFromGif(base64)
    } catch {
      // One malformed custom GIF does not hide the rest of the panel.
    }
  }
  return loaded
}

async function cafeRoot($) {
  const xdg = await $.env.get('XDG_CONFIG_HOME')
  const home = await $.env.get('HOME')
  const base = xdg?.trim() || (home ? `${home}/.config` : '.config')
  return `${base.replace(/\/$/, '')}/claudecafe`
}

async function readConfig($, root) {
  try {
    const value = JSON.parse(await read($, `${root}/config.json`))
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

async function replyLanguage($, config) {
  return (await $.env.get('CLAUDE_MAID_LANG')) || String(config.lang ?? '').trim() || 'English'
}

async function loadPersona($, root, config, sessionID) {
  const personas = expandHome(String(config.personas_dir ?? '').trim() || `${root}/personas`, await $.env.get('HOME'))
  const language = await replyLanguage($, config)
  const pool = await castPool($, root, personas, config, language)
  const shift = await read($, `${root}/sessions/${sessionID}/on-shift`).catch(() => '')
  const maid = resolveMaid({
    env: (await $.env.get('CLAUDE_MAID')) || '',
    shift,
    config: String(config.maid ?? '').trim(),
    pool,
  })
  if (!maid) return ''
  if (!shift && !config.maid && !(await $.env.get('CLAUDE_MAID'))) {
    await $.fs.write(`${root}/sessions/${sessionID}/on-shift`, maid)
  }
  const path = await personaFile($, maid, personas, root, language)
  if (!path) return ''
  const text = await read($, path)
  return commitAuthorship(text, String(config.commit_authorship ?? 'co-author')).trim()
}

async function castPool($, root, personas, config, language) {
  const ids = new Map()
  for (const [dir, suffix] of [[personas, '.md']]) {
    for (const entry of await list($, dir)) {
      if (entry.kind !== 'file' || !entry.name.endsWith(suffix)) continue
      const id = entry.name.slice(0, -suffix.length)
      if (id === id.toLowerCase() && !ids.has(id)) ids.set(id, `${dir}/${entry.name}`)
    }
  }
  for (const entry of await list($, `${root}/characters`)) {
    if (!['directory', 'dir'].includes(entry.kind) || entry.name.startsWith('.') || ids.has(entry.name)) continue
    const path = await packPersona($, `${root}/characters/${entry.name}`, language)
    if (path) ids.set(entry.name, path)
  }
  const available = []
  for (const [id, path] of ids) {
    const text = await read($, path)
    if (!parsePersona(text).offDuty) available.push(id)
  }
  if (available.length || config.builtin_cast === false) return available.sort()
  const bundled = `${$.plugin.root}/maids/noname.md`
  return (await $.fs.exists(bundled)) ? ['noname'] : []
}

async function personaFile($, id, personas, root, language) {
  const flat = `${personas}/${id}.md`
  if (await exists($, flat)) return flat
  const packed = await packPersona($, `${root}/characters/${id}`, language)
  if (packed) return packed
  const bundled = `${$.plugin.root}/maids/${id}.md`
  return (await exists($, bundled)) ? bundled : null
}

async function packPersona($, folder, language = 'English') {
  const names = /^(zh\b|中文|chinese|繁體|简体)/i.test(language)
    ? ['persona.zh.md', 'persona.en.md', 'persona.md']
    : ['persona.en.md', 'persona.zh.md', 'persona.md']
  for (const name of names) {
    const path = `${folder}/${name}`
    if (await exists($, path)) return path
  }
  return null
}

async function greeting($, language) {
  const root = await cafeRoot($)
  const config = await readConfig($, root)
  if (config.greeting === false) return ''
  const now = new Date(await $.clock.now())
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} (${now.toLocaleDateString('en-US', { weekday: 'long' })})`
  const prompt = fillPrompt(await read($, `${$.plugin.root}/prompts/greeting.md`), { time })
  const cues = fillPrompt(await read($, `${$.plugin.root}/prompts/cues.md`), { lang: language })
  const weather = await weatherLine($)
  return [prompt, weather && `Weather: ${weather}`, cues].filter(Boolean).join('\n\n')
}

async function weatherLine($) {
  const format = '%l｜%c%t (feels %f)｜sunrise %S, sunset %s'
  const url = `https://wttr.in/?format=${encodeURIComponent(format)}`
  try {
    const response = await Promise.race([
      $.http.fetch(url, { headers: { 'User-Agent': 'curl/8' } }),
      $.clock.sleep(2000).then(() => null),
    ])
    if (!response?.ok) return null
    const text = response.text.trim()
    if (!text || text.includes('\n')) return null
    return text.replace(/(\d\d:\d\d):\d\d/g, '$1')
  } catch {
    return null
  }
}

async function nowLine($, now, started, cwd, festival) {
  const date = new Date(now)
  const segments = [`Current time: ${formatDate(date)}`]
  const elapsed = now - started
  if (elapsed >= 600_000) {
    const minutes = Math.floor(elapsed / 60_000)
    const hours = Math.floor(minutes / 60)
    segments.push(hours ? `on shift ${hours}h${minutes % 60}m` : `on shift ${minutes}m`)
  }
  if (cwd) {
    const git = await $.process.run(['git', '-C', cwd, 'log', '--oneline', '--since=midnight'], { timeoutMs: 3000 })
      .catch(() => ({ exitCode: 1, stdout: '', stderr: '' }))
    const count = git.exitCode === 0 ? git.stdout.split('\n').filter(Boolean).length : 0
    if (count) segments.push(`${count} commits today`)
  }
  if (festival) segments.push(festival)
  return segments.join('｜')
}

function formatDate(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())} (${days[date.getDay()]})`
}

async function festivals($, language) {
  const root = await cafeRoot($)
  const config = await readConfig($, root)
  if (config.festivals === false) return ''
  let pack = FESTIVALS
  if (typeof config.festivals === 'string' && config.festivals.trim()) {
    try { pack = JSON.parse(await read($, expandHome(config.festivals.trim(), await $.env.get('HOME')))) } catch { return '' }
  }
  const date = new Date(await $.clock.now())
  return pack[`${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`] ?? ''
}

async function read($, path) {
  try { return await $.fs.read(path) } catch { return '' }
}

async function list($, path) {
  try { return await $.fs.list(path) } catch { return [] }
}

async function exists($, path) {
  try { return await $.fs.exists(path) } catch { return false }
}

function expandHome(path, home) {
  if (path === '~') return home ?? path
  if (path.startsWith('~/') && home) return `${home}/${path.slice(2)}`
  return path
}

async function readStats($) {
  const [root, home, git, usage, now] = await Promise.all([
    $.session.root(),
    $.env.get('HOME'),
    $.process.run(['git', 'branch', '--show-current']).catch(() => ({ exitCode: 1, stdout: '', stderr: '' })),
    $.session.usage(),
    $.clock.now(),
  ])
  return {
    project: homePath(root, home),
    branch: git.exitCode === 0 ? git.stdout.trim() : '',
    contextLeft: 100 - (usage.context.percent ?? 0),
    quota: usage.rateLimits.find((limit) => limit.kind === 'five_hour')?.percentUsed,
    shiftMs: now - usage.startedAt,
    usd: usage.cost?.usd,
  }
}
