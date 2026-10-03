import {
  PUBLISHED_CHARACTER_PACKS,
  commitAuthorship,
  compareVersions,
  readContext,
  expressionPrompt,
  expressionToolDescription,
  markedFace,
  parsePersona,
  personaFiles,
  resolveCharacter,
} from '../../../character-core/src/index.ts'
import {
  AVATAR, CUT_IN_MS, NAME_GAP, NAME_TAG_HEIGHT, PANE_WASH, ROSE, THOUGHT_INK,
  avatarSvg, cutInSvg, gapSvg, nameTagSvg, petalField, portraitSvg, spacerSvg,
} from './desktop.js'
import { faceFromGif } from './faces.js'
import { homePath, statusRows } from './stats.js'

const TOOL = 'mcp__persona-panel__set_expression'
const CUT_IN_TOOL = 'mcp__persona-panel__cut_in'
const PANE = { id: 'persona-panel', title: 'Pixel art' }
const PORTRAIT_PANE = { id: 'persona-portrait', title: 'Portrait' }
const BLOCK = 'persona-panel'
/** Long enough to be read twice over before it is replaced, as the desktop holds a line. */
const WAITING_MS = 4500
/** The desktop stage's widest, in columns: about 540 pixels, the portrait's own width (the pane reports no pixels). */
const STAGE_COLUMNS = 64
/** Her thought: how many recent happenings it reads, how often it may chime in while she works, and its height. */
const THOUGHT_CONTEXT = 8
const THOUGHT_EVERY_MS = 30000
const THOUGHT_LINES = 3
const THOUGHTS_OFF = 'Thoughts off — set "thoughts": true to hear them.'

export function register(on) {
  let session
  let expression = 'neutral'
  let waitingTick
  let greeted = false
  // The desktop's: the cut-in playing above the prompt, the face her latest reply closed on, and her unsaid thought.
  const stage = { cutIn: null }
  const portrait = { face: 'neutral' }
  const thought = { log: [], line: '', face: null, isBusy: false, at: 0 }

  on('session.start', async ($, event, next) => {
    const result = await next(event)
    greeted = false
    session = openSession($, event.cwd || await $.session.cwd(), await sessionSurface($, event))
    await session
    return result
  })

  on('turn.complete', async ($, event, next) => {
    const result = await next(event)
    if (event.agentId) return result
    waitingTick?.cancel()
    waitingTick = undefined
    const state = await session
    if (state?.hasPanel) {
      // Her reply's closing mood marker names a face, as the desktop reads it.
      const face = markedFace(event.answer)
      if (face && Object.hasOwn(state.faces, face)) expression = face
      state.stats = await readStats($)
      await $.ui.invalidate('ui.render')
    }
    if (state?.desktop) {
      const face = markedFace(event.answer)
      if (face && Object.hasOwn(state.desktop.avatars, face)) portrait.face = face
      await $.ui.invalidate('ui.render')
      remember(thought, `${state.character.name} replied`, event.answer)
      await think($, state, thought)
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
    session ??= openSession($, await $.session.cwd(), (await $.session.surfaces())[0])
    const state = await session
    if (state.desktop) remember(thought, 'the user said', event.text)
    if (state.hasPanel && (await $.ui.panes()).some((pane) => pane.id === PANE.id && !pane.isPlaced)) {
      await openPane($)
    }
    // The spinner draws once per turn unless asked again, so her waiting lines turn over on a timer.
    waitingTick ??= $.clock.every(WAITING_MS, () => $.ui.invalidate('ui.render'))
    return next(event)
  })

  on('prompt.context', async ($, event, next) => {
    const context = await next(event)
    session ??= openSession($, await $.session.cwd(), (await $.session.surfaces())[0])
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

  on('tool.call', { tool: CUT_IN_TOOL }, async ($, event) => {
    const played = await playCutIn($, await session, stage, event.face, event.shout || `${event.face.toUpperCase()}!`)
    return played ? { result: 'Cut-in played.' } : { deny: `Unknown face: ${String(event.face)}` }
  })

  on('tool.call', async ($, event, next) => {
    const state = await session
    if (state?.desktop && !event.agentId && event.tool !== CUT_IN_TOOL) {
      // A batch of calls shares the cut-in its first one starts.
      if (!stage.cutIn) await playCutIn($, state, stage, 'focused', `${event.tool.replace(/^mcp__.*__/, '').toUpperCase()}!`)
      remember(thought, `she ran ${event.tool}`, toolSubject(event))
      // While she works, she chimes in now and then, not on every call.
      if ((await $.clock.now()) - thought.at > THOUGHT_EVERY_MS) void think($, state, thought)
    }
    return next(event)
  })

  on('command.run', { command: 'portrait' }, async ($) => {
    await $.ui.open(PORTRAIT_PANE)
    return { text: 'Portrait pane opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, event, next) => {
    if (event.surface !== 'desktop' || !stage.cutIn) return next(event)
    const { Svg } = $.ui.resolve(event)
    return h(Svg, { source: cutInSvg(stage.cutIn), alt: stage.cutIn.shout })
  })

  on('ui.render', { component: 'Pane', requestId: PORTRAIT_PANE.id }, async ($, event, next) => {
    const state = await session
    if (event.surface !== 'desktop' || !state?.desktop) return next(event)
    // Once she has thought something, the portrait wears the face that thought chose, not the reply's.
    return portraitPane($, event, state, thought.face ?? portrait.face, thought.line)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, event, next) => {
    const reply = await next(event)
    const state = await session
    if (event.surface !== 'desktop' || !state?.desktop) return reply
    return replyWithAvatar($, event, state, reply)
  })

  on('ui.render', { component: 'Spinner' }, async ($, event, next) => {
    const waiting = (await session)?.waiting ?? []
    if (!waiting.length) return next(event)
    const word = waiting[Math.floor(await $.clock.now() / WAITING_MS) % waiting.length]
    return next({ ...event, props: { ...event.props, word } })
  })

  on('ui.render', { component: 'Pane', requestId: PANE.id }, async ($, event, next) => {
    const state = await session
    const face = state?.faces[expression]
    if (event.surface !== 'terminal' || !face) return next(event)

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

/**
 * The surface the session draws on: the terminal only when it is interactive. The desktop starts a session
 * without naming its surface, so it is asked for.
 */
async function sessionSurface($, event) {
  if (event.surface === 'terminal') return event.isInteractive ? 'terminal' : undefined
  return event.surface ?? (await $.session.surfaces())[0]
}

/**
 * Picks the session's character, then sets up what the surface draws of her: on an interactive terminal the pixel
 * panel when her pack has pixels, on the desktop her avatars, portrait pane and cut-ins when it has those.
 */
async function openSession($, cwd, surface) {
  const root = await dataRoot($)
  const config = await readConfig($, root)
  const character = await loadCharacter($, root, config, await $.session.id())
  const faces = surface === 'terminal' && character?.pack ? await loadFaces($, `${character.pack}/pixels`) : {}
  const desktop = surface === 'desktop' && character ? await loadDesktop($, castDirs($, root), character.id, config) : null
  const state = {
    cwd,
    hasPanel: Object.keys(faces).length > 0,
    language: await replyLanguage($, config),
    startedAt: await $.clock.now(),
    character,
    faces,
    stats: undefined,
    waiting: character?.waiting ?? [],
    desktop,
  }
  if (desktop) await openDesktop($, Object.keys(desktop.avatars))
  if (surface === 'desktop') {
    // Her pictures come from her pack: a missing or older one is fetched in the background and drawn once it lands.
    void installPacks($, root).then(async (installed) => {
      if (!character || !installed.includes(character.id)) return
      const wasDrawn = Boolean(state.desktop)
      state.desktop = await loadDesktop($, castDirs($, root), character.id, config)
      if (state.desktop && !wasDrawn) await openDesktop($, Object.keys(state.desktop.avatars))
      await $.ui.invalidate('ui.render')
    })
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

/**
 * Her desktop pictures from the first character folder that has them: the pack's `avatars/` and
 * `portraits-540/`. The plugin bundles none, so without a pack the desktop draws nothing of her.
 */
async function loadDesktop($, dirs, id, config) {
  for (const dir of dirs) {
    const folder = `${dir}/${id}`
    const avatars = await loadPictures($, folder, 'avatars')
    if (avatars.neutral && await exists($, `${folder}/portraits-540/neutral.webp`)) {
      return { folder, avatars, thinks: config.thoughts === true }
    }
  }
  return null
}

async function openDesktop($, faces) {
  await $.tool.register({
    name: 'cut_in',
    description: 'Plays a fighting-game cut-in above the prompt: your half-body sweeps across a slanted band with a shout beside it, then leaves. Save it for big moments — a hard bug beaten, a long task finished — not every reply.',
    inputSchema: {
      type: 'object',
      properties: {
        face: { type: 'string', enum: faces },
        shout: { type: 'string', maxLength: 12, description: 'The words beside you, in capitals or a few CJK characters; defaults to the face name.' },
      },
      required: ['face'],
      additionalProperties: false,
    },
  })
  await $.command.register({ name: 'portrait', description: 'Open the portrait pane' })
  await $.ui.open(PORTRAIT_PANE)
}

/**
 * Her reply with her avatar beside it: it opens with her neutral face and closes on the one its mood marker
 * names, her name over each; the blocks between keep the indent.
 */
function replyWithAvatar($, event, state, reply) {
  const { avatars } = state.desktop
  const marked = markedFace(event.props.text)
  const face = marked && Object.hasOwn(avatars, marked) ? marked : event.props.isFirstOfReply ? 'neutral' : null
  const { Box, Markdown, Svg, Text } = $.ui.resolve(event)
  return h(Box, { alignItems: 'flex-start', marginTop: event.props.isFirstOfReply ? 1 : 0 },
    h(Svg, { source: face ? avatarSvg(avatars[face]) : spacerSvg(), alt: face ?? 'indent', width: AVATAR, height: face ? AVATAR : 1 }),
    h(Box, { flexDirection: 'column', flexGrow: 1, marginLeft: 2 },
      face && h(Box, { gap: 1, alignItems: 'center' },
        h(Text, { bold: true, color: ROSE }, state.character.name),
        // Only a link takes a press without looking like a button, so the glyph that opens her pane is one;
        // its address is only where it goes if the press is not caught.
        h(Markdown, { key: `portrait:${event.requestId}`, text: `[◨](https://claudecafe.dev/${state.character.id})`, onLinkPress: () => $.ui.open(PORTRAIT_PANE) }),
      ),
      face && h(Svg, { source: gapSvg(NAME_GAP), alt: 'gap', width: 1, height: NAME_GAP }),
      reply,
    ),
  )
}

/**
 * Her portrait at the foot of the pane, with her unsaid thought in a box over her skirt and sakura drifting over
 * all of it. She and the box share one centred stage, sized in columns, so they always match; the box is drawn
 * from the start and holds an ellipsis until her first thought arrives, or, with thoughts off, how to turn them on.
 */
async function portraitPane($, event, state, face, line) {
  const { Box, Svg, Text } = $.ui.resolve(event)
  // The pane's own size in rows and columns; percentages do not fill it.
  const rows = event.props.scroll?.bodyRows ?? event.viewport?.rows
  const columns = event.props.bodyColumns
  const width = columns && Math.min(columns, STAGE_COLUMNS)
  const picture = await readPicture($, state.desktop.folder, 'portraits-540', face)
  const tag = nameTagSvg(`${state.character.name}（心の声）`)
  // The pane's own colour: a positioned background would paint over her.
  return h(Box, { position: 'relative', overflow: 'hidden', flexDirection: 'column', justifyContent: 'flex-end', backgroundColor: PANE_WASH, ...(rows ? { height: rows } : {}) },
    h(Box, { position: 'relative', flexShrink: 0, flexDirection: 'column', alignSelf: 'center', ...(width ? { width } : {}) },
      picture && h(Svg, { source: portraitSvg(picture), alt: `${state.character.name}, ${face}` }),
      h(Box, { position: 'absolute', left: 0, bottom: 1, flexDirection: 'column', ...(width ? { width } : {}) },
        // Half the tag's height of air, so the tag drawn last can straddle the box's top border.
        h(Svg, { source: gapSvg(NAME_TAG_HEIGHT / 2), alt: 'gap', width: 1, height: NAME_TAG_HEIGHT / 2 }),
        h(Box, { flexDirection: 'column', marginX: 1, paddingX: 2, paddingY: 1, borderStyle: 'round', borderColor: ROSE, backgroundColor: 'rgba(255,250,251,0.92)' },
          h(Box, { height: THOUGHT_LINES, overflow: 'hidden' }, state.desktop.thinks
            ? h(Text, { color: THOUGHT_INK }, line || '……')
            : h(Text, { color: THOUGHT_INK, dimColor: true }, THOUGHTS_OFF))),
        h(Box, { position: 'absolute', top: 0, left: 3 }, h(Svg, { source: tag.source, alt: tag.text, width: tag.width, height: NAME_TAG_HEIGHT })),
      ),
    ),
    columns && rows && h(Box, { position: 'absolute', top: 0, left: 0, width: columns * 2 }, h(Svg, { source: petalField(rows, columns), alt: 'falling sakura' })),
  )
}

/**
 * Brings each published pack into the café data root when the one there is missing or older, as the desktop app
 * and OpenCode do. A failure leaves the old pack and is tried again next session. Returns the ids installed.
 */
async function installPacks($, root) {
  const installed = []
  for (const pack of PUBLISHED_CHARACTER_PACKS) {
    try {
      if (await installPack($, root, pack)) installed.push(pack.id)
    } catch {
      // The pack already there, if any, stays in use.
    }
  }
  return installed
}

/**
 * The hooks runtime fetches and writes text only, so the system's curl and unzip carry the archive; its SHA-256
 * is checked here before anything is unpacked, and the new folder replaces the old one only once it is whole.
 */
async function installPack($, root, pack) {
  const folder = `${root}/characters/${pack.id}`
  const current = parsePersona(await read($, `${folder}/persona.md`)).version
  if (current && compareVersions(current, pack.version) >= 0) return false

  const staging = `${root}/characters/.${pack.id}-${await $.clock.now()}`
  try {
    await mustRun($, ['mkdir', '-p', staging])
    await mustRun($, ['curl', '-fsSL', '--max-time', '60', '-o', `${staging}/pack.zip`, pack.url])
    const { base64 } = await $.fs.read(`${staging}/pack.zip`, { as: 'bytes' })
    if (await sha256(base64) !== pack.sha256) throw new Error(`${pack.id} pack SHA-256 mismatch`)
    await mustRun($, ['unzip', '-q', `${staging}/pack.zip`, '-d', staging])
    if (parsePersona(await read($, `${staging}/${pack.id}/persona.md`)).version !== pack.version) {
      throw new Error(`${pack.id} pack holds an unexpected persona version`)
    }
    if (await exists($, folder)) await mustRun($, ['mv', folder, `${staging}/previous`])
    await mustRun($, ['mv', `${staging}/${pack.id}`, folder])
    return true
  } finally {
    await $.process.run(['rm', '-rf', staging], { timeoutMs: 30_000 }).catch(() => {})
  }
}

async function mustRun($, argv) {
  const ran = await $.process.run(argv, { timeoutMs: 90_000 })
  if (ran.exitCode !== 0) throw new Error(`${argv[0]} exited ${ran.exitCode}: ${ran.stderr.trim()}`)
}

async function sha256(base64) {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Sends her half-body across the band above the prompt, which closes again once it has played. */
async function playCutIn($, state, stage, face, shout) {
  const picture = state?.desktop && await readPicture($, state.desktop.folder, 'portraits-540', face)
  if (!picture) return false

  stage.cutIn = { picture, shout }
  await $.ui.invalidate('ui.render')
  $.clock.after(CUT_IN_MS, async () => {
    stage.cutIn = null
    await $.ui.invalidate('ui.render')
  })
  return true
}

/** Keeps the last few things that happened, cut short, for her next thought. */
function remember(thought, what, text) {
  const said = String(text ?? '').replace(/\s+/g, ' ').trim()
  thought.log = [...thought.log, `${what}: ${said.length > 300 ? `${said.slice(0, 300)}…` : said}`].slice(-THOUGHT_CONTEXT)
}

/** What a tool call was pointed at, as a few words for her thought. */
function toolSubject(event) {
  return String(event.command ?? event.file_path ?? event.pattern ?? event.description ?? event.prompt ?? '').slice(0, 120)
}

/**
 * Asks Sonnet for her unsaid thought on what just happened, in her voice and sharp-tongued, with the face she
 * makes while thinking it; the pane shows both. Only when config `thoughts` is true.
 */
async function think($, state, thought) {
  if (!state.desktop.thinks || thought.isBusy || !thought.log.length) return
  thought.isBusy = true
  thought.at = await $.clock.now()
  // Fewer tokens than this leave nothing after the model's own thinking: the reply comes back empty.
  const reply = await $.model.complete({
    model: 'sonnet',
    effort: 'low',
    maxTokens: 600,
    timeoutMs: 15000,
    system: `${state.character.persona}\n\nYou are thinking to yourself, in a visual-novel text box beside the conversation, words you keep to yourself. `
      + 'One short line, at most 30 characters: a sharp-tongued tsukkomi on what just happened, the snark she is too polite to say aloud. '
      + 'Roast the work, the bug or the master\'s choices freely, but never his person, looks or worth. '
      + `No quotes, no kaomoji, no markdown.${state.language ? ` Write it in ${state.language}.` : ''}\n\n`
      + `Answer as one line: the face you make while thinking it, one of ${Object.keys(state.desktop.avatars).join(', ')}, then | then the thought.`,
    prompt: `What just happened, oldest first:\n${thought.log.join('\n')}\n\nface|thought:`,
  })
  thought.isBusy = false
  if (!reply.isAnswered) return
  const [face, ...words] = reply.text.trim().split('\n')[0].split('|')
  thought.line = (words.length ? words.join('|') : face).trim()
  if (words.length && Object.hasOwn(state.desktop.avatars, face.trim())) thought.face = face.trim()
  await $.ui.invalidate('ui.render')
}

async function readPicture($, folder, set, face) {
  try {
    return (await $.fs.read(`${folder}/${set}/${face}.webp`, { as: 'bytes' })).base64
  } catch {
    return null
  }
}

/** Every picture in one of a pack's sets, by expression id. */
async function loadPictures($, folder, set) {
  const loaded = {}
  for (const entry of await list($, `${folder}/${set}`)) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.webp')) continue
    const face = entry.name.slice(0, -'.webp'.length)
    const picture = await readPicture($, folder, set, face)
    if (picture) loaded[face] = picture
  }
  return loaded
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

/** The character this session already has, else the configured one, else the default; kept for the session. */
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
  const pack = await packFolder($, dirs, id, variant)
  const path = await personaFile($, id, pack, variant)
  if (!path) return null
  const text = await read($, path)
  const persona = parsePersona(text)
  return {
    id,
    name: persona.name || id,
    waiting: persona.waiting,
    persona: commitAuthorship(text, String(config.commit_authorship ?? 'co-author')).trim(),
    pack,
  }
}

async function castPool($, dirs, variant) {
  const ids = new Set()
  for (const dir of dirs) {
    for (const entry of await list($, dir)) {
      if (['directory', 'dir'].includes(entry.kind) && !entry.name.startsWith('.')) ids.add(entry.name)
    }
  }
  const available = []
  for (const id of ids) {
    const pack = await packFolder($, dirs, id, variant)
    if (pack && !parsePersona(await read($, await packPersona($, pack, variant))).offDuty) available.push(id)
  }
  if (available.length) return available.sort()
  const bundled = `${$.plugin.root}/fallback/noname.md`
  return (await $.fs.exists(bundled)) ? ['noname'] : []
}

/** The user's character folders, then the cast bundled with the plugin. */
function castDirs($, root) {
  return [`${root}/characters`, `${$.plugin.root}/characters`]
}

/**
 * The newest copy of a character: a user's folder goes stale when only the
 * plugin updates, so the bundled cast wins on a higher persona version. The
 * user's copy wins a tie, which keeps hand-made packs in charge.
 */
async function packFolder($, dirs, id, variant) {
  let newest = null
  for (const dir of dirs) {
    const folder = `${dir}/${id}`
    const path = await packPersona($, folder, variant)
    if (!path) continue
    const version = parsePersona(await read($, path)).version
    if (!newest || compareVersions(version, newest.version) > 0) newest = { folder, version }
  }
  return newest?.folder ?? null
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
