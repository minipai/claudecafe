import type { EngineInterface, Register } from 'claude-code'
import { faceFromGif, type Face } from './faces'
import { expressionPrompt } from './prompt'
import { homePath, statusRows, type Stats } from './stats'

const tool = 'mcp__cc-maid__set_expression'
const pane = { id: 'cc-maid', title: 'Pixel art' }
const name = 'ことね'

export const register: Register = (on) => {
  let faces: Record<string, Face> = {}
  let expression = 'neutral'
  let mood = ''
  let stats: Stats | undefined
  let enabled = false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    if (e.surface === 'terminal' && e.isInteractive) {
      faces = await loadFaces($)
      await $.tool.register({
        name: 'set_expression',
        description: 'Change the mood shown beside your name and your visible pixel portrait in the Cafe panel. '
          + 'Mood is a short, freely worded description of your present emotional tone, in the language you are replying in; not an activity or progress update. '
          + 'Use when your emotional tone changes or the user asks for an expression; do not call on every reply or repeat the current state. '
          + 'Both stay until changed. neutral is calm; happy is smiling with closed eyes; '
          + 'flirty blows a kiss; excited is bright-eyed delight; surprised is shock; wink is a playful wink. '
          + 'This changes the actual panel, independently of the text mood marker.',
        inputSchema: {
          type: 'object',
          properties: {
            mood: { type: 'string', minLength: 1, maxLength: 24 },
            expression: { type: 'string', enum: Object.keys(faces) },
          },
          required: ['mood', 'expression'],
          additionalProperties: false,
        },
      })
      enabled = true
      stats = await readStats($)
      await $.ui.invalidate('prompt.context')
      await $.ui.open(pane)
      // The shift clock moves on between turns too.
      $.clock.every(60_000, async () => {
        stats = await readStats($)
        await $.ui.invalidate('ui.render')
      })
    }
    return result
  })

  // A subagent's turns end too; the figures are the main loop's.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (enabled && !e.agentId) {
      stats = await readStats($)
      await $.ui.invalidate('ui.render')
    }
    return result
  })

  on('command.run', { command: 'clear' }, async ($, e, next) => {
    if (expression !== 'neutral' || mood) {
      expression = 'neutral'
      mood = ''
      await $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // A pane the plugin opens on its own waits undrawn below 144 columns; one
  // opened while answering the person's prompt is placed at any width.
  on('prompt.submit', async ($, e, next) => {
    if (enabled && (await $.ui.panes()).some(open => open.id === pane.id && !open.isPlaced)) {
      await $.ui.open(pane)
    }
    return next(e)
  })

  on('prompt.context', async ($, e, next) => {
    const context = await next(e)
    if (!enabled) return context
    return {
      blocks: [
        ...context.blocks.filter(block => block.name !== 'cc-maid'),
        { name: 'cc-maid', text: expressionPrompt },
      ],
    }
  })

  on('tool.call', { tool }, async ($, e) => {
    const selected = e.expression
    if (typeof selected !== 'string' || !Object.hasOwn(faces, selected)) {
      return { deny: `Unknown expression: ${String(selected)}` }
    }
    const felt = typeof e.mood === 'string' ? e.mood.trim() : ''
    if (selected !== expression || felt !== mood) {
      expression = selected
      mood = felt
      await $.ui.invalidate('ui.render')
    }
    return { result: `Expression: ${expression}` }
  })

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    const face = faces[expression]
    if (e.surface !== 'terminal' || e.requestId !== pane.id || !face) return next(e)

    const { Box, Text, Raster } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" alignItems="center" width={e.props.bodyColumns} height={e.props.scroll.bodyRows}>
        <Box flexDirection="column" width={face.columns} marginTop={1}>
          {(stats ? statusRows(stats) : []).flatMap((row, index) => [
            // The project heads the block, a blank row rather than a rule beneath it.
            ...(index > 1 ? [<Text dimColor>{rule(face)}</Text>] : []),
            <Box {...(index ? {} : { marginBottom: 1 })}>
              {row.map(({ text, ...style }) => <Text {...style}>{text}</Text>)}
            </Box>,
          ])}
        </Box>
        <Box flexGrow={1} />
        <Box borderStyle="round" flexDirection="column" alignItems="center">
          <Raster key="panel-image" {...face} />
          <Text dimColor>{rule(face)}</Text>
          <Box>
            <Text bold>{name}</Text>
            {mood ? <Text dimColor>{` · ${mood}`}</Text> : null}
          </Box>
        </Box>
      </Box>
    )
  })
}

/**
 * Kotone's pixel GIFs, each file's name the expression it shows: `pixels/` links
 * to her cast folder in the repository and is copied in when the plugin ships.
 */
async function loadFaces($: EngineInterface): Promise<Record<string, Face>> {
  const directory = `${$.plugin.root}/pixels`
  const names = (await $.fs.list(directory))
    .filter(entry => entry.kind === 'file' && entry.name.endsWith('.gif'))
    .map(entry => entry.name.slice(0, -'.gif'.length))
  return Object.fromEntries(await Promise.all(names.map(async name => {
    const { base64 } = await $.fs.read(`${directory}/${name}.gif`, { as: 'bytes' })
    return [name, faceFromGif(base64)] as const
  })))
}

function rule(face: Face): string {
  return '┄'.repeat(face.columns)
}

async function readStats($: EngineInterface): Promise<Stats> {
  const [root, home, git, usage, now] = await Promise.all([
    $.session.root(),
    $.env.get('HOME'),
    $.process.run(['git', 'branch', '--show-current']),
    $.session.usage(),
    $.clock.now(),
  ])
  return {
    project: homePath(root, home),
    branch: git.exitCode === 0 ? git.stdout.trim() : '',
    contextLeft: 100 - (usage.context.percent ?? 0),
    quota: usage.rateLimits.find(limit => limit.kind === 'five_hour')?.percentUsed,
    shiftMs: now - usage.startedAt,
    usd: usage.cost?.usd,
  }
}
