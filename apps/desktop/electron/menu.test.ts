import { beforeEach, describe, expect, it, vi } from 'vitest'

const { setApplicationMenu, buildFromTemplate } = vi.hoisted(() => ({
  setApplicationMenu: vi.fn(),
  buildFromTemplate: vi.fn((template) => template),
}))
vi.mock('electron', () => ({ Menu: { setApplicationMenu, buildFromTemplate } }))

import { buildMenu } from './menu'
import { WINDOW_KEYS } from '../src/agent/windowKeys'

describe('window accelerators', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registers the shared shortcut map natively and dispatches each intended target', () => {
    const open = vi.fn()
    buildMenu('en', open)
    const menus = buildFromTemplate.mock.calls[0][0] as Array<{ submenu?: Array<Record<string, unknown>> }>
    const items = menus[4].submenu!
    const commands = items.filter((item) => item.accelerator)
    expect(commands.map(({ accelerator }) => accelerator)).toEqual(WINDOW_KEYS.map(({ accelerator }) => accelerator))
    expect(commands.every((item) => item.registerAccelerator !== false)).toBe(true)
    commands.forEach((item) => (item.click as () => void)())
    expect(open.mock.calls).toEqual(WINDOW_KEYS.map(({ window }) => [window]))
  })
})
