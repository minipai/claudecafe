import type { Register } from 'claude-code'
import { loadFaces } from './faces'
import { expressionPrompt } from './prompt'

const tool = 'mcp__cc-maid__set_expression'
const pane = { id: 'cc-maid', title: 'Pixel art' }

export const register: Register = (on) => {
  const faces = loadFaces()
  let expression = 'neutral'
  let enabled = false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    if (e.surface === 'terminal' && e.isInteractive) {
      await $.tool.register({
        name: 'set_expression',
        description: 'Change your visible pixel portrait in the Cafe panel to match your current emotion. '
          + 'Use when your emotional tone changes or the user asks for an expression; do not call on every reply or repeat the current expression. '
          + 'The portrait stays until changed. neutral is calm; happy is smiling with closed eyes; '
          + 'flirty blows a kiss; impressed is delighted amazement; surprised is shock; wink is a playful wink. '
          + 'This changes the actual panel image, independently of the text mood marker.',
        inputSchema: {
          type: 'object',
          properties: { expression: { type: 'string', enum: Object.keys(faces) } },
          required: ['expression'],
          additionalProperties: false,
        },
      })
      enabled = true
      await $.ui.invalidate('prompt.context')
      await $.ui.open(pane)
    }
    return result
  })

  on('command.run', { command: 'clear' }, async ($, e, next) => {
    if (expression !== 'neutral') {
      expression = 'neutral'
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
    if (selected !== expression) {
      expression = selected
      await $.ui.invalidate('ui.render')
    }
    return { result: `Expression: ${expression}` }
  })

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.surface !== 'terminal' || e.requestId !== pane.id) return next(e)

    const { Raster } = $.ui.resolve(e)
    return <Raster key="panel-image" {...faces[expression]!} />
  })
}
