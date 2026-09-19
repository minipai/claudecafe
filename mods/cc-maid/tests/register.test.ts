import type { RenderElement, RenderInput } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'
import { loadFaces } from '../hooks/faces'

const expressions = loadFaces()

const tool = 'mcp__cc-maid__set_expression'
const panelImage = expressions.neutral

describe('Cafe image pane', () => {
  test('opens the image after the interactive terminal session starts', async ($, on) => {
    mock.clock(on)
    const events: string[] = []
    on('session.start', (_, e) => {
      events.push('start')
      return { cwd: e.cwd }
    })
    on('tool.register', (_, e) => {
      events.push('register')
      expect(e.name).toBe('set_expression')
      expect(e.description.length > 0).toBe(true)
      expect(e.inputSchema).toMatchObject({
        type: 'object', properties: { expression: { type: 'string', enum: Object.keys(expressions) } },
        required: ['expression'],
      })
      return { value: { tool } }
    })
    on('ui.invalidate', (_, e) => {
      events.push(`invalidate:${e.event}`)
      return { value: undefined }
    })
    on('ui.open', (_, e) => {
      events.push('open')
      expect(e).toEqual({ id: 'cc-maid', title: 'Pixel art' })
      return { value: undefined }
    })
    expect(await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true }))
      .toEqual({ cwd: '/work' })
    expect(events).toEqual(['start', 'register', 'invalidate:prompt.context', 'open'])
  })

  for (const context of [
    { surface: 'terminal', isInteractive: false },
    { surface: 'desktop', isInteractive: true },
    { surface: 'mobile', isInteractive: true },
  ] as const) {
    test(`does not open for ${context.surface}, interactive=${context.isInteractive}`, async ($, on) => {
      const clock = mock.clock(on)
      let opens = 0
      let registrations = 0
      on('tool.register', () => { registrations++; return { value: { tool } } })
      on('session.start', (_, e) => ({ cwd: e.cwd }))
      on('ui.open', () => { opens++; return { value: undefined } })
      on('prompt.context', (_, e) => e)
      await $.session.start({ cwd: '/work', ...context })
      expect(opens).toBe(0)
      expect(registrations).toBe(0)
      const prompt = { blocks: [{ name: 'persona', text: 'Existing persona' }] }
      expect(await $.prompt.context(prompt)).toEqual(prompt)
      await clock.advance(3000)
      expect(await $.ui.render(pane())).toEqual({
        type: 'Raster', props: { key: 'panel-image', ...panelImage },
      raster: { plugin: 'cc-maid' },
      })
    })
  }

  for (const [name, isPlaced, reopens] of [
    ['reopens the pane waiting undrawn on a narrow terminal', false, 1],
    ['leaves a pane the surface already placed alone', true, 0],
  ] as const) {
    test(name, async ($, on) => {
      let opens = 0
      on('session.start', (_, e) => ({ cwd: e.cwd }))
      on('tool.register', () => ({ value: { tool } }))
      on('ui.invalidate', () => ({ value: undefined }))
      on('ui.open', (_, e) => { opens++; expect(e).toEqual({ id: 'cc-maid', title: 'Pixel art' }); return { value: undefined } })
      on('ui.panes', () => ({ value: [{ id: 'cc-maid', title: 'Pixel art', isShown: true, isFocused: false, isPlaced }] }))
      on('prompt.submit', (_, e) => ({ text: e.text }))
      await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
      expect(opens).toBe(1)
      expect(await $.prompt.submit({ text: 'hello' })).toEqual({ text: 'hello' })
      expect(opens).toBe(1 + reopens)
    })
  }

  test('leaves a pane the person closed shut', async ($, on) => {
    let opens = 0
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('tool.register', () => ({ value: { tool } }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.open', () => { opens++; return { value: undefined } })
    on('ui.panes', () => ({ value: [] }))
    on('prompt.submit', (_, e) => ({ text: e.text }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.prompt.submit({ text: 'hello' })
    expect(opens).toBe(1)
  })

  test('preserves context before the interactive session enables the tool', async ($, on) => {
    const context = { blocks: [{ name: 'persona', text: 'Existing persona' }] }
    on('prompt.context', (_, e) => e)
    expect(await $.prompt.context(context)).toEqual(context)
  })

  test('adds stable portrait instructions while preserving other context and replacing its own block', async ($, on) => {
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('tool.register', () => ({ value: { tool } }))
    on('ui.open', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('prompt.context', (_, e) => ({
      blocks: [...e.blocks, { name: 'other-plugin', text: 'Other plugin context' }],
    }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const input = { blocks: [
      { name: 'persona', text: 'Existing persona' },
      { name: 'cc-maid', text: 'Outdated portrait instructions' },
    ] }
    const context = await $.prompt.context(input)
    expect(context.blocks).toHaveLength(3)
    expect(context.blocks[0]).toEqual(input.blocks[0])
    expect(context.blocks[1]).toEqual({ name: 'other-plugin', text: 'Other plugin context' })
    expect(context.blocks[2]?.name).toBe('cc-maid')
    expect(context.blocks[2]?.text).toContain(tool)
    expect(context.blocks[2]?.text).not.toBe('Outdated portrait instructions')
    await $.tool.call({ tool, expression: 'happy' })
    expect(await $.prompt.context(input)).toEqual(context)
    await $.tool.call({ tool, expression: 'angry' })
    expect(await $.prompt.context(input)).toEqual(context)
  })

  test('draws the packed image with plugin raster provenance', async ($) => {
    expect(await $.ui.render(pane())).toEqual({
      type: 'Raster', props: { key: 'panel-image', ...panelImage },
      raster: { plugin: 'cc-maid' },
    })
  })

  test('keeps the neutral image after time passes', async ($, on) => {
    const clock = mock.clock(on)
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('tool.register', () => ({ value: { tool } }))
    on('ui.open', () => ({ value: undefined }))
    on('ui.invalidate', () => ({ value: undefined }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await clock.advance(9000)
    expect(await $.ui.render(pane())).toEqual({
      type: 'Raster', props: { key: 'panel-image', ...panelImage },
      raster: { plugin: 'cc-maid' },
    })
  })

  test('resets the expression to neutral after /clear', async ($, on) => {
    const invalidations: string[] = []
    on('command.run', (_, e) => {
      expect(e.command).toBe('clear')
      return { text: 'cleared' }
    })
    on('ui.invalidate', (_, e) => { invalidations.push(e.event); return { value: undefined } })
    await $.tool.call({ tool, expression: 'happy' })
    invalidations.length = 0

    expect(await $.command.run({ command: 'clear' })).toEqual({ text: 'cleared' })

    expect(invalidations).toEqual(['ui.render'])
    expect(await $.ui.render(pane())).toEqual({
      type: 'Raster', props: { key: 'panel-image', ...expressions.neutral },
      raster: { plugin: 'cc-maid' },
    })
  })

  test('switches every expression and keeps the last selection until another call', async ($, on) => {
    const clock = mock.clock(on)
    const invalidations: string[] = []
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('tool.register', () => ({ value: { tool } }))
    on('ui.open', () => ({ value: undefined }))
    on('ui.invalidate', (_, e) => { invalidations.push(e.event); return { value: undefined } })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    expect(invalidations).toEqual(['prompt.context'])
    invalidations.length = 0
    expect(Object.keys(expressions)).toHaveLength(26)
    let previous = 'neutral'
    let changes = 0
    for (const [expression, image] of Object.entries(expressions)) {
      expect(await $.tool.call({ tool, expression })).toEqual({ result: `Expression: ${expression}` })
      if (expression !== previous) changes++
      expect(invalidations).toEqual(Array(changes).fill('ui.render'))
      expect(await $.ui.render(pane())).toEqual({
        type: 'Raster', props: { key: 'panel-image', ...image },
        raster: { plugin: 'cc-maid' },
      })
      await $.tool.call({ tool, expression })
      await clock.advance(9000)
      expect(invalidations).toHaveLength(changes)
      expect(await $.ui.render(pane())).toEqual({
        type: 'Raster', props: { key: 'panel-image', ...image },
        raster: { plugin: 'cc-maid' },
      })
      previous = expression
    }
  })

  for (const expression of ['missing', 'Happy', '__proto__', 'constructor', '', undefined, null, 42]) {
    test(`rejects invalid expression ${String(expression)} without changing the face`, async ($, on) => {
      let invalidations = 0
      on('ui.invalidate', () => { invalidations++; return { value: undefined } })
      await $.tool.call({ tool, expression: 'happy' })
      expect(invalidations).toBe(1)
      expect(await $.tool.call({ tool, expression })).toEqual({ deny: `Unknown expression: ${String(expression)}` })
      expect(invalidations).toBe(1)
      expect(await $.ui.render(pane())).toEqual({
        type: 'Raster', props: { key: 'panel-image', ...expressions.happy },
        raster: { plugin: 'cc-maid' },
      })
    })
  }

  test('preserves other tools without redrawing the portrait', async ($, on) => {
    let invalidations = 0
    on('ui.invalidate', () => { invalidations++; return { value: undefined } })
    on('tool.call', { tool: 'Bash' }, () => ({ text: 'unchanged', result: { stdout: '/work', stderr: '', interrupted: false } }))
    expect(await $.tool.call({ tool: 'Bash', command: 'pwd' })).toEqual({ text: 'unchanged', result: { stdout: '/work', stderr: '', interrupted: false } })
    expect(invalidations).toBe(0)
  })

  for (const input of [
    { ...pane(), requestId: 'another-plugin' },
    { ...pane(), surface: 'desktop' as const },
    { ...pane(), surface: 'mobile' as const },
  ]) {
    test(`preserves pane ${input.requestId} on ${input.surface}`, async ($, on) => {
      const existing: RenderElement = { type: 'Text', children: ['Other pane'] }
      on('ui.render', { component: 'Pane' }, () => existing)
      expect(await $.ui.render(input)).toEqual(existing)
    })
  }

  test('preserves assistant replies', async ($, on) => {
    const existing: RenderElement = { type: 'Text', children: ['Original reply'] }
    on('ui.render', { component: 'AssistantMessage' }, () => existing)
    expect(await $.ui.render({
      surface: 'terminal', component: 'AssistantMessage', requestId: 'reply-1',
      props: { text: 'Original reply', isFirstOfReply: true },
    })).toEqual(existing)
  })

  for (const [expression, image] of Object.entries(expressions)) {
    test(`encodes the ${expression} image with transparent cells and a bounded palette`, () => {
      expect(image.columns).toBe(48)
      expect(image.rows).toBe(152)
      const bytes = Uint8Array.from(atob(image.cells), char => char.charCodeAt(0))
      expect(bytes.length).toBe(image.columns * image.rows * 12)
      const cells = new DataView(bytes.buffer)
      const pairs = new Set<string>()
      for (let offset = 0; offset < bytes.length; offset += 12) {
        const glyph = cells.getUint32(offset, true)
        expect([0x20, 0x2580, 0x2584].includes(glyph)).toBe(true)
        const foreground = cells.getUint32(offset + 4, true)
        const background = cells.getUint32(offset + 8, true)
        if (glyph === 0x20) {
          expect(foreground).toBe(0x1000000)
          expect(background).toBe(0x1000000)
        } else {
          expect(foreground <= 0xffffff).toBe(true)
          expect(background <= 0x1000000).toBe(true)
          if (glyph === 0x2584) expect(background).toBe(0x1000000)
        }
        pairs.add(`${foreground}:${background}`)
      }
      expect(pairs.size <= 1024).toBe(true)
    })
  }
})

function pane(): RenderInput<'Pane', 'terminal'> {
  return {
    surface: 'terminal', component: 'Pane', requestId: 'cc-maid',
    props: {
      title: 'Pixel art', isFocused: true, bodyColumns: 50, placement: 'dock',
      scroll: { offset: 0, bodyRows: 152 }, view: {},
    },
  }
}
