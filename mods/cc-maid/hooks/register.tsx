import type { Register } from 'claude-code'
import { expressions, type Expression } from './expressions'
import { expressionPrompt } from './prompt'

const tool = 'mcp__cc-maid__set_expression'

export const register: Register = (on) => {
  let expression: Expression = 'neutral'
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
          properties: { expression: { type: 'string', enum: Object.keys(expressions) } },
          required: ['expression'],
          additionalProperties: false,
        },
      })
      enabled = true
      await $.ui.invalidate('prompt.context')
      await $.ui.open({ id: 'cc-maid', title: 'Pixel art' })
    }
    return result
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
    if (typeof selected !== 'string' || !Object.hasOwn(expressions, selected)) {
      return { deny: `Unknown expression: ${String(selected)}` }
    }
    if (selected !== expression) {
      expression = selected as Expression
      await $.ui.invalidate('ui.render')
    }
    return { result: `Expression: ${expression}` }
  })

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.surface !== 'terminal' || e.requestId !== 'cc-maid') return next(e)

    const { Raster } = $.ui.resolve(e)
    return <Raster key="panel-image" {...expressions[expression]} />
  })
}
