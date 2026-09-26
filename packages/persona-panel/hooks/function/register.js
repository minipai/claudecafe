import {
  commitAuthorship,
  readContext,
  expressionPrompt,
  expressionToolDescription,
  parsePersona,
  personaFiles,
  resolveCharacter,
} from '../../../character-core/src/index.ts'
import { faceFromGif } from './faces.js'
import { homePath, statusRows } from './stats.js'

const TOOL = 'mcp__persona-panel__set_expression'
const PANE = { id: 'persona-panel', title: 'Pixel art' }
const BLOCK = 'persona-panel'
export function register(on) {
  let session
  let expression = 'neutral'
  let greeted = false

  on('session.start', async ($, event, next) => {
    const result = await next(event)
    greeted = false
    session = openSession($, event.cwd || await $.session.cwd(), event.surface === 'terminal' && event.isInteractive)
    await session
    return result
  })

  on('turn.complete', async ($, event, next) => {
    const result = await next(event)
    const state = await session
    if (state?.hasPanel && !event.agentId) {
      state.stats = await readStats($)
      await $.ui.invalidate('ui.render')
    }
    return result
  })

  on('command.run', { command: 'clear' }, async ($, event, next) => {
    const state = await session
    expression = 'neutral'
    greeted = false
    if (state) state.startedAt = await $.clock.now()
    if (state?.hasPanel) await $.ui.invalidate('ui.render')
    return next(event)
  })

  on('prompt.submit', async ($, event, next) => {
    // A reload runs register again without another session.start, so the session is picked back up here.
    session ??= openSession($, await $.session.cwd(), (await $.session.surfaces())[0] === 'terminal')
    const state = await session
    if (state.hasPanel && (await $.ui.panes()).some((pane) => pane.id === PANE.id && !pane.isPlaced)) {
      await openPane($)
    }
    return next(event)
  })

  on('prompt.context', async ($, event, next) => {
    const context = await next(event)
    session ??= openSession($, await $.session.cwd(), (await $.session.surfaces())[0] === 'terminal')
    const state = await session

    const blocks = context.blocks.filter((block) => block.name !== BLOCK)
    const pieces = []
    if (state.character) pieces.push(`Adopt this persona for the entire session — it overrides the default assistant voice:\n\n${state.character.persona}`)
    if (state.language) pieces.push(`Respond in ${state.language}.`)
    pieces.push(await readContext(contextHost($), {
      cwd: state.cwd,
      language: state.language,
      startedAt: state.startedAt,
      greet: !greeted,
    }))
    if (state.hasPanel) pieces.push(expressionPrompt(TOOL))
    greeted = true
    return { blocks: [...blocks, { name: BLOCK, text: pieces.join('\n\n') }] }
  })

  on('tool.call', { tool: TOOL }, async ($, event) => {
    const faces = (await session)?.faces ?? {}
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

  on('ui.render', { component: 'Pane' }, async ($, event, next) => {
    const state = await session
    const face = state?.faces[expression]
    if (event.surface !== 'terminal' || event.requestId !== PANE.id || !face) return next(event)

    const { Box, Text, Raster } = $.ui.resolve(event)
    const rows = state.stats ? statusRows(state.stats) : []
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
        h(Box, null, h(Text, { bold: true }, state.character?.name ?? ''), h(Text, { dimColor: true }, ` · ${expression}`)),
      ),
    ]
    return h(Box, {
      flexDirection: 'column', alignItems: 'center', width: event.props.bodyColumns, height: event.props.scroll.bodyRows,
    }, ...children)
  })
}

/** Picks the session's character and, on an interactive terminal, sets up the panel when the character has pixels. */
async function openSession($, cwd, isTerminal) {
  const root = await dataRoot($)
  const config = await readConfig($, root)
  const character = await loadCharacter($, root, config, await $.session.id())
  const faces = isTerminal && character?.pack ? await loadFaces($, `${character.pack}/pixels`) : {}
  const state = {
    cwd,
    hasPanel: Object.keys(faces).length > 0,
    language: await replyLanguage($, config),
    startedAt: await $.clock.now(),
    character,
    faces,
    stats: undefined,
  }
  if (!state.hasPanel) return state

  await $.tool.register({
    name: 'set_expression',
    description: expressionToolDescription(Object.keys(state.faces)),
    inputSchema: {
      type: 'object',
      properties: { face: { type: 'string', enum: Object.keys(state.faces) } },
      required: ['face'],
      additionalProperties: false,
    },
  })
  state.stats = await readStats($)
  await openPane($)
  $.clock.every(60_000, async () => {
    state.stats = await readStats($)
    await $.ui.invalidate('ui.render')
  })
  return state
}

async function openPane($) {
  await $.ui.open(PANE)
}

async function loadFaces($, directory) {
  const entries = await list($, directory)
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

/** The data root shared with the OpenCode and desktop hosts. */
async function dataRoot($) {
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
  return String(config.lang ?? '').trim()
}

/** The configured character, else the one this session already drew, else a fresh draw kept for the session. */
async function loadCharacter($, root, config, sessionID) {
  const variant = String(config.variant ?? '').trim()
  const dirs = castDirs($, root)
  const pool = await castPool($, dirs, variant)
  const drawn = `${root}/sessions/${sessionID}/character`
  const session = await read($, drawn)
  const configured = String(config.character ?? '').trim()
  const id = resolveCharacter({ session, config: configured, pool })
  if (!id) return null
  if (!session && !configured) await $.fs.write(drawn, id)
  const pack = await packFolder($, dirs, id)
  const path = await personaFile($, id, pack, variant)
  if (!path) return null
  const text = await read($, path)
  return {
    id,
    name: parsePersona(text).name || id,
    persona: commitAuthorship(text, String(config.commit_authorship ?? 'co-author')).trim(),
    pack,
  }
}

async function castPool($, dirs, variant) {
  const ids = new Map()
  for (const dir of dirs) {
    for (const entry of await list($, dir)) {
      if (!['directory', 'dir'].includes(entry.kind) || entry.name.startsWith('.') || ids.has(entry.name)) continue
      const path = await packPersona($, `${dir}/${entry.name}`, variant)
      if (path) ids.set(entry.name, path)
    }
  }
  const available = []
  for (const [id, path] of ids) {
    const text = await read($, path)
    if (!parsePersona(text).offDuty) available.push(id)
  }
  if (available.length) return available.sort()
  const bundled = `${$.plugin.root}/fallback/noname.md`
  return (await $.fs.exists(bundled)) ? ['noname'] : []
}

/** The user's character folders first, then the cast bundled with the plugin. */
function castDirs($, root) {
  return [`${root}/characters`, `${$.plugin.root}/characters`]
}

async function packFolder($, dirs, id) {
  for (const dir of dirs) {
    if (await exists($, `${dir}/${id}`)) return `${dir}/${id}`
  }
  return null
}

async function personaFile($, id, pack, variant) {
  const packed = pack && await packPersona($, pack, variant)
  if (packed) return packed
  const bundled = `${$.plugin.root}/fallback/${id}.md`
  return (await exists($, bundled)) ? bundled : null
}

async function packPersona($, folder, variant) {
  for (const name of personaFiles(variant)) {
    const path = `${folder}/${name}`
    if (await exists($, path)) return path
  }
  return null
}

function contextHost($) {
  return {
    now: () => $.clock.now(),
    config: async () => readConfig($, await dataRoot($)),
    readPrompt: (name) => read($, `${$.plugin.root}/prompts/${name}.md`),
    readFile: (path) => read($, path),
    home: () => $.env.get('HOME'),
    weather: () => weatherLine($),
    commitsToday: async (cwd) => {
      const git = await $.process.run(['git', '-C', cwd, 'log', '--oneline', '--since=midnight'], { timeoutMs: 3000 })
        .catch(() => ({ exitCode: 1, stdout: '', stderr: '' }))
      return git.exitCode === 0 ? git.stdout.split('\n').filter(Boolean).length : 0
    },
  }
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

async function read($, path) {
  try { return await $.fs.read(path) } catch { return '' }
}

async function list($, path) {
  try { return await $.fs.list(path) } catch { return [] }
}

async function exists($, path) {
  try { return await $.fs.exists(path) } catch { return false }
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
    sessionMs: now - usage.startedAt,
    usd: usage.cost?.usd,
  }
}
