import type { On, RenderElement, RenderInput } from 'claude-code'
import { describe, expect, mock, test, type Engine, type MockClock } from 'claude-code/testing'
import type { Face } from '../hooks/function/faces.js'

// Three 2×2 GIFs, each with a transparent pixel or a shared colour, and the
// half-block cells they decode to.
const gifs: Record<string, string> = {
  neutral: 'R0lGODlhAgACAIEAAMgoKAAAACjIKCgoyCH5BAEAAAEALAAAAAACAAIAAAgHAAEEEDAgIAA7',
  happy: 'R0lGODlhAgACAIEAAAAAAPrIAAAAAAAAACH5BAEAAAAALAAAAAACAAIAAAgHAAEACBAgIAA7',
  angry: 'R0lGODlhAgACAIEAAP8AAAoKCgAAAAAAACH5BAEAAAIALAAAAAACAAIAAAgHAAEACCAgIAA7',
}
const DEFAULT = 0x1000000
const expressions: Record<string, Face> = {
  neutral: face([0x2580, 0xc82828, 0x28c828], [0x2584, 0x2828c8, DEFAULT]),
  happy: face([0x2584, 0xfac800, DEFAULT], [0x2584, 0xfac800, DEFAULT]),
  angry: face([0x2580, 0xff0000, 0x0a0a0a], [0x2580, 0xff0000, DEFAULT]),
}

const tool = 'mcp__cafe__set_expression'
const panelImage = expressions.neutral!
const placed = { isPlaced: true } as const
const submission = { text: 'hello', wait: false, origin: { kind: 'composer' } } as const
const clear = {
  command: 'clear', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 },
} as const

describe('Cafe image pane', () => {
  test('opens the image after the interactive terminal session starts', async ($, on) => {
    world(on)
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
        type: 'object',
        properties: { face: { type: 'string', enum: Object.keys(expressions) } },
        required: ['face'],
      })
      return { value: { tool } }
    })
    on('ui.invalidate', (_, e) => {
      events.push(`invalidate:${e.event}`)
      return { value: undefined }
    })
    on('ui.open', (_, e) => {
      events.push('open')
      expect(e).toEqual({ id: 'cafe', title: 'Pixel art' })
      return { value: placed }
    })
    expect(await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true }))
      .toEqual({ cwd: '/work' })
    expect(events).toEqual(['start', 'register', 'open'])
  })

  for (const context of [
    { surface: 'terminal', isInteractive: false },
    { surface: 'desktop', isInteractive: true },
    { surface: 'mobile', isInteractive: true },
  ] as const) {
    test(`does not open for ${context.surface}, interactive=${context.isInteractive}`, async ($, on) => {
      const { clock } = world(on)
      const existing: RenderElement = { type: 'Text', children: ['Undrawn pane'] }
      on('ui.render', { component: 'Pane' }, () => existing)
      let opens = 0
      let registrations = 0
      on('tool.register', () => { registrations++; return { value: { tool } } })
      on('session.start', (_, e) => ({ cwd: e.cwd }))
      on('ui.open', () => { opens++; return { value: placed } })
      on('prompt.context', (_, e) => e)
      await $.session.start({ cwd: '/work', ...context })
      expect(opens).toBe(0)
      expect(registrations).toBe(0)
      const prompt = { blocks: [{ name: 'persona', text: 'Existing persona' }] }
      const withCafe = await $.prompt.context(prompt)
      expect(withCafe.blocks[0]).toEqual(prompt.blocks[0])
      expect(withCafe.blocks[1]?.name).toBe('cafe')
      expect(withCafe.blocks[1]?.text).toContain('Adopt this persona')
      expect(withCafe.blocks[1]?.text).not.toContain('mcp__cafe__set_expression')
      await clock.advance(3000)
      expect(await $.ui.render(pane())).toEqual(existing)
    })
  }

  for (const [name, isPlaced, reopens] of [
    ['reopens the pane waiting undrawn on a narrow terminal', false, 1],
    ['leaves a pane the surface already placed alone', true, 0],
  ] as const) {
    test(name, async ($, on) => {
      let opens = 0
      world(on)
      on('session.start', (_, e) => ({ cwd: e.cwd }))
      on('tool.register', () => ({ value: { tool } }))
      on('ui.invalidate', () => ({ value: undefined }))
      on('ui.open', (_, e) => { opens++; expect(e).toEqual({ id: 'cafe', title: 'Pixel art' }); return { value: placed } })
      on('ui.panes', () => ({ value: [{ id: 'cafe', title: 'Pixel art', isShown: true, isFocused: false, isPlaced }] }))
      on('prompt.submit', (_, e) => ({ text: e.text }))
      await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
      expect(opens).toBe(1)
      expect(await $.prompt.submit(submission)).toEqual({ text: 'hello' })
      expect(opens).toBe(1 + reopens)
    })
  }

  test('leaves a pane the person closed shut', async ($, on) => {
    let opens = 0
    world(on)
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('tool.register', () => ({ value: { tool } }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.open', () => { opens++; return { value: placed } })
    on('ui.panes', () => ({ value: [] }))
    on('prompt.submit', (_, e) => ({ text: e.text }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.prompt.submit(submission)
    expect(opens).toBe(1)
  })

  test('picks the session back up when a reload skipped session.start', async ($, on) => {
    world(on)
    on('session.cwd', () => ({ value: '/work' }))
    on('session.surfaces', () => ({ value: ['terminal'] }))
    on('tool.register', () => ({ value: { tool } }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.open', () => ({ value: placed }))
    on('prompt.context', (_, e) => e)
    const context = await $.prompt.context({ blocks: [] })
    expect(context.blocks[0]?.text).toContain('Adopt this persona')
    expect(context.blocks[0]?.text).toContain('Kurumi body.')
    expect(context.blocks[0]?.text).toContain(tool)
    expect(await $.ui.render(pane())).toEqual(drawn(panelImage))
  })

  test('adds stable portrait instructions while preserving other context and replacing its own block', async ($, on) => {
    on('ui.invalidate', () => ({ value: undefined }))
    on('prompt.context', (_, e) => ({
      blocks: [...e.blocks, { name: 'other-plugin', text: 'Other plugin context' }],
    }))
    await start($, on)
    const input = { blocks: [
      { name: 'persona', text: 'Existing persona' },
      { name: 'cafe', text: 'Outdated portrait instructions' },
    ] }
    const context = await $.prompt.context(input)
    expect(context.blocks).toHaveLength(3)
    expect(context.blocks[0]).toEqual(input.blocks[0])
    expect(context.blocks[1]).toEqual({ name: 'other-plugin', text: 'Other plugin context' })
    expect(context.blocks[2]?.name).toBe('cafe')
    expect(context.blocks[2]?.text).toContain('Current time:')
    expect(context.blocks[2]?.text).toContain(tool)
    expect(context.blocks[2]?.text).not.toBe('Outdated portrait instructions')
    await $.tool.call({ tool, face: 'happy' })
    const afterHappy = await $.prompt.context(input)
    expect(afterHappy.blocks.slice(0, 2)).toEqual(context.blocks.slice(0, 2))
    expect(afterHappy.blocks[2]?.name).toBe('cafe')
    await $.tool.call({ tool, face: 'angry' })
    const afterAngry = await $.prompt.context(input)
    expect(afterAngry.blocks.slice(0, 2)).toEqual(context.blocks.slice(0, 2))
    expect(afterAngry.blocks[2]?.name).toBe('cafe')
  })

  test('draws the status above the framed GIF and her name, with plugin raster provenance', async ($, on) => {
    on('ui.invalidate', () => ({ value: undefined }))
    await start($, on)
    expect(await $.ui.render(pane())).toEqual(drawn(panelImage))
  })

  test('keeps the neutral image after time passes', async ($, on) => {
    on('ui.invalidate', () => ({ value: undefined }))
    const { clock } = await start($, on)
    await clock.advance(9000)
    expect(await $.ui.render(pane())).toEqual(drawn(panelImage))
  })

  test('resets the expression to neutral after /clear', async ($, on) => {
    const invalidations: string[] = []
    on('command.run', (_, e) => {
      expect(e.command).toBe('clear')
      return { text: 'cleared' }
    })
    on('ui.invalidate', (_, e) => { invalidations.push(e.event); return { value: undefined } })
    await start($, on)
    await $.tool.call({ tool, face: 'happy' })
    invalidations.length = 0

    expect(await $.command.run(clear)).toEqual({ text: 'cleared' })

    expect(invalidations).toEqual(['ui.render'])
    expect(await $.ui.render(pane())).toEqual(drawn(expressions.neutral!))
  })

  test('switches every expression and keeps the last selection until another call', async ($, on) => {
    const invalidations: string[] = []
    on('ui.invalidate', (_, e) => { invalidations.push(e.event); return { value: undefined } })
    const { clock } = await start($, on)
    expect(invalidations).toEqual([])
    invalidations.length = 0
    expect(Object.keys(expressions)).toHaveLength(3)
    let previous = 'neutral'
    let changes = 0
    for (const [expression, image] of Object.entries(expressions)) {
      expect(await $.tool.call({ tool, expression })).toEqual({ result: `Face: ${expression}` })
      if (expression !== previous) changes++
      expect(invalidations).toEqual(Array(changes).fill('ui.render'))
      expect(await $.ui.render(pane())).toEqual(drawn(image, shift, expression))
      await $.tool.call({ tool, expression })
      await clock.advance(9000)
      expect(invalidations).toHaveLength(changes)
      expect(await $.ui.render(pane())).toEqual(drawn(image, shift, expression))
      previous = expression
    }
  })

  for (const expression of ['missing', 'Happy', '__proto__', 'constructor', '', undefined, null, 42]) {
    test(`rejects invalid expression ${String(expression)} without changing the face`, async ($, on) => {
      let invalidations = 0
      on('ui.invalidate', () => { invalidations++; return { value: undefined } })
      await start($, on)
      invalidations = 0
      await $.tool.call({ tool, face: 'happy' })
      expect(invalidations).toBe(1)
      expect(await $.tool.call({ tool, face: expression })).toEqual({ deny: `Unknown face: ${String(expression)}` })
      expect(invalidations).toBe(1)
      expect(await $.ui.render(pane())).toEqual(drawn(expressions.happy!, shift, 'happy'))
    })
  }

  test('preserves other tools, leaving the panel alone before the session enables it', async ($, on) => {
    let invalidations = 0
    on('ui.invalidate', () => { invalidations++; return { value: undefined } })
    on('tool.call', { tool: 'Bash' }, () => ({ text: 'unchanged', result: { stdout: '/work', stderr: '', interrupted: false } }))
    expect(await $.tool.call({ tool: 'Bash', command: 'pwd' })).toEqual({ text: 'unchanged', result: { stdout: '/work', stderr: '', interrupted: false } })
    expect(invalidations).toBe(0)
  })

  test('shows the current expression beside her name', async ($, on) => {
    on('ui.invalidate', () => ({ value: undefined }))
    await start($, on)
    await $.tool.call({ tool, face: 'happy' })
    expect(await $.ui.render(pane())).toEqual(drawn(expressions.happy!, shift, 'happy'))
  })

  test('refreshes the status when a turn ends and as the shift clock moves on', async ($, on) => {
    on('ui.invalidate', () => ({ value: undefined }))
    on('turn.complete', (_, e) => ({ text: e.answer }))
    const { clock, figures } = await start($, on)
    Object.assign(figures, { percent: 81, quota: undefined, usd: undefined, branch: '' })
    await $.turn.complete({ reason: 'answer', answer: 'Done.', durationMs: 10, isAborted: false, turnId: 't1' })
    const later: Figures = { ...figures, shiftMinutes: 7 * 60 + 7 }
    expect(await $.ui.render(pane())).toEqual(drawn(panelImage, later))

    figures.shiftMinutes = 8 * 60
    await clock.advance(60_000)
    expect(await $.ui.render(pane())).toEqual(drawn(panelImage, { ...later, shiftMinutes: 8 * 60 }))
  })

  test('leaves the status alone when a subagent turn ends', async ($, on) => {
    on('ui.invalidate', () => ({ value: undefined }))
    on('turn.complete', (_, e) => ({ text: e.answer }))
    const { figures } = await start($, on)
    figures.percent = 90
    await $.turn.complete({
      reason: 'answer', answer: 'Found it.', durationMs: 10, isAborted: false, turnId: 't2', agentId: 'a1',
    })
    expect(await $.ui.render(pane())).toEqual(drawn(panelImage))
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
})

/** Answers the cast directory: one maid, くるみ, with her own GIFs and a stray file beside them. */
function pixels(on: On): void {
  on('fs.list', (_, e) => {
    if (e.path?.endsWith('/claudecafe/characters')) {
      return { value: [{ name: 'kurumi', kind: 'directory' as const, size: 0, isLink: false }] }
    }
    if (e.path?.endsWith('/characters/kurumi/pixels')) {
      const names = [...Object.keys(gifs).map(name => `${name}.gif`), 'README.md']
      return { value: names.map(name => ({ name, kind: 'file' as const, size: 0, isLink: false })) }
    }
    return { value: [] }
  })
  on('fs.read', (_, e) => {
    if (e.as === 'bytes') {
      return { value: { base64: gifs[e.path.split('/').at(-1)!.replace('.gif', '')]! } }
    }
    if (e.path?.endsWith('/config.json')) return { value: '{}' }
    if (e.path?.endsWith('/prompts/greeting.md')) return { value: 'Greet at $time.' }
    if (e.path?.endsWith('/prompts/cues.md')) return { value: 'Cues for $lang.' }
    if (e.path?.endsWith('/characters/kurumi/persona.en.md')) return { value: '---\nname: くるみ\n---\nKurumi body.\n' }
    return { value: '' }
  })
  on('fs.exists', (_, e) => ({
    value: e.path?.endsWith('/characters/kurumi/persona.en.md') === true,
  }))
  on('fs.write', () => ({ value: undefined }))
}

/** What the session reports: context used, the five-hour limit, the shift so far, the branch. */
type Figures = { percent: number; quota?: number; usd?: number; shiftMinutes: number; branch: string }
const shift: Figures = { percent: 22, quota: 31, usd: 2.41, shiftMinutes: 7 * 60 + 7, branch: 'main' }

/** The world beneath the plugin: the cast directory, the session's figures and a mocked clock. */
function world(on: On): { clock: MockClock; figures: Figures } {
  const clock = mock.clock(on)
  const figures = { ...shift }
  pixels(on)
  on('session.usage', () => ({
    value: {
      startedAt: clock.now() - figures.shiftMinutes * 60_000,
      context: { window: 200_000, percent: figures.percent },
      rateLimits: figures.quota === undefined ? [] : [{ kind: 'five_hour', percentUsed: figures.quota }],
      ...(figures.usd === undefined ? {} : { cost: { usd: figures.usd } }),
    },
  }))
  on('session.root', () => ({ value: '/home/maid/Dev/claudecafe' }))
  on('session.id', () => ({ value: 'test-session' }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/maid' : undefined }))
  on('http.fetch', () => { throw new Error('offline') })
  on('process.run', (_, e) => {
    if (e.argv.includes('branch')) {
      return { value: figures.branch
        ? { exitCode: 0, stdout: `${figures.branch}\n`, stderr: '' }
        : { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' } }
    }
    return { value: { exitCode: 0, stdout: 'one commit\n', stderr: '' } }
  })
  return { clock, figures }
}

async function start($: Engine, on: On): Promise<{ clock: MockClock; figures: Figures }> {
  const handles = world(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.register', () => ({ value: { tool } }))
  on('ui.open', () => ({ value: placed }))
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  return handles
}

function face(...cells: number[][]): Face {
  const bytes = new Uint8Array(Uint32Array.from(cells.flat()).buffer)
  return { columns: cells.length, rows: 1, cells: btoa(String.fromCharCode(...bytes)) }
}

/** The panel: the status block on top, then the portrait framed with her name and expression beneath it. */
function drawn(image: Face, figures: Figures = shift, expression = 'neutral'): RenderElement {
  const title: RenderElement[] = [
    { type: 'Text', props: { bold: true }, children: ['くるみ'] },
    { type: 'Text', props: { dimColor: true }, children: [` · ${expression}`] },
  ]
  return {
    type: 'Box', props: { flexDirection: 'column', alignItems: 'center', width: 38, height: 40 },
    children: [
      {
        type: 'Box', props: { flexDirection: 'column', width: image.columns, marginTop: 1 },
        children: status(figures).flatMap((row, index) => [
          ...(index > 1 ? [rule(image)] : []),
          { type: 'Box', ...(index ? {} : { props: { marginBottom: 1 } }), children: row },
        ]),
      },
      { type: 'Box', props: { flexGrow: 1 } },
      {
        type: 'Box', props: { borderStyle: 'round', flexDirection: 'column', alignItems: 'center' },
        children: [
          { type: 'Raster', props: { key: 'panel-image', ...image }, raster: { plugin: 'cafe' } },
          rule(image),
          { type: 'Box', children: title },
        ],
      },
    ],
  }
}

function status({ percent, quota, usd, shiftMinutes, branch }: Figures): RenderElement[][] {
  const left = 100 - percent
  const quotaLeft = quota === undefined ? undefined : 100 - quota
  const hours = Math.floor(shiftMinutes / 60)
  const time = `${hours}h${String(shiftMinutes % 60).padStart(2, '0')}m`
  return [
    [{ type: 'Text', props: { bold: true, wrap: 'truncate-start' }, children: ['~/Dev/claudecafe'] }],
    ...(branch ? [[text(`⎇ ${branch}`)]] : []),
    [text('HP '), ...bar(left, gauge(left, 'green')), text(`  context left ${left}%`)],
    [text('MP '), ...bar(quotaLeft ?? 0, gauge(quotaLeft ?? 0, 'cyan')), text(`  5h left ${quotaLeft === undefined ? '—' : `${quotaLeft}%`}`)],
    [text(`⏱ on shift ${time}${usd === undefined ? '' : `    $${usd.toFixed(2)}`}`)],
  ]
}

function gauge(left: number, full: string): string {
  return left > 50 ? full : left > 20 ? 'yellow' : 'red'
}

function bar(percent: number, color: string): RenderElement[] {
  const filled = Math.round(percent / 10)
  return [
    { type: 'Text', props: { color }, children: ['█'.repeat(filled)] },
    { type: 'Text', props: { dimColor: true }, children: ['░'.repeat(10 - filled)] },
  ]
}

function rule(image: Face): RenderElement {
  return { type: 'Text', props: { dimColor: true }, children: ['┄'.repeat(image.columns)] }
}

function text(content: string): RenderElement {
  return { type: 'Text', children: [content] }
}

function pane(): RenderInput<'Pane', 'terminal'> {
  return {
    surface: 'terminal', component: 'Pane', requestId: 'cafe',
    props: {
      title: 'Pixel art', isFocused: true, bodyColumns: 38, placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 }, view: {},
    },
  }
}
