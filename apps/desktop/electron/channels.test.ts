import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * preload.ts and main.ts agree on a `cafe:*` channel name only by both
 * spelling it the same way — nothing in the types catches a typo on one side,
 * and importing main.ts here would need a real Electron app running just to
 * evaluate it. So this reads both files as text instead and checks the two
 * string sets actually line up.
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const preloadSource = stripComments(fs.readFileSync(path.join(here, 'preload.ts'), 'utf8'))
const mainSource = stripComments(fs.readFileSync(path.join(here, 'main.ts'), 'utf8'))

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/** Every `cafe:...` literal passed to `.<method>(` — tolerant of quote style,
 * and run against comment-stripped source so a channel merely mentioned in
 * prose doesn't count. */
function channelsCalledWith(source: string, method: string) {
  const pattern = new RegExp(`\\.${method}\\(\\s*['"\`](cafe:[a-z-]+)['"\`]`, 'g')
  return new Set([...source.matchAll(pattern)].map((match) => match[1]))
}

// The renderer starting something — a one-way `send` or a round-trip
// `invoke` — which main.ts must answer with a matching `ipcMain.on`/`.handle`.
const rendererInitiated = new Set([
  ...channelsCalledWith(preloadSource, 'send'),
  ...channelsCalledWith(preloadSource, 'invoke'),
])
const mainHandled = new Set([...channelsCalledWith(mainSource, 'on'), ...channelsCalledWith(mainSource, 'handle')])

// The reverse direction: main.ts pushing at the renderer unasked — the agent
// stream, the maid's pointer — which preload.ts must be listening for with
// `ipcRenderer.on`/`.off`, never asking main to answer back on the same name.
const mainInitiated = new Set([...channelsCalledWith(preloadSource, 'on'), ...channelsCalledWith(preloadSource, 'off')])
const mainSent = channelsCalledWith(mainSource, 'send')

describe('cafe:* IPC channel parity', () => {
  it('every channel the renderer starts has a handler registered in main', () => {
    expect([...rendererInitiated].sort()).toEqual([...mainHandled].sort())
  })

  it('every channel main pushes unasked is one preload is listening for', () => {
    expect([...mainSent].sort()).toEqual([...mainInitiated].sort())
  })

  it('the one-sided channels are exactly these two, and here is why', () => {
    // cafe:event carries the whole agent-message stream, cafe:pointer-at the
    // maid's live pointer position while she is being dragged — main.ts
    // pushes both at the renderer on its own schedule, and nothing the
    // renderer does ever answers back on the same channel name.
    expect([...mainInitiated].sort()).toEqual(['cafe:event', 'cafe:pointer-at'])
  })
})
