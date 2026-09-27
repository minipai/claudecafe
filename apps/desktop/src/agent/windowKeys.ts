import type { SideWindow } from './bridge'

/** One source for the shortcuts that bring a café window forward. */
export const WINDOW_KEYS = [
  { window: null, accelerator: 'CmdOrCtrl+Shift+0', display: '⌘⇧0' },
  { window: 'log', accelerator: 'CmdOrCtrl+L', display: '⌘L' },
  { window: 'reply', accelerator: 'CmdOrCtrl+Shift+L', display: '⌘⇧L' },
  { window: 'projects', accelerator: 'CmdOrCtrl+Shift+O', display: '⌘⇧O' },
  { window: 'models', accelerator: 'CmdOrCtrl+Shift+M', display: '⌘⇧M' },
  { window: 'usage', accelerator: 'CmdOrCtrl+Shift+U', display: '⌘⇧U' },
  { window: 'settings', accelerator: 'CmdOrCtrl+,', display: '⌘,' },
] as const satisfies readonly { window: SideWindow | null; accelerator: string; display: string }[]
