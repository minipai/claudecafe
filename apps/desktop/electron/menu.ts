import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { SideWindow } from '../src/agent/bridge'

/** The side windows the Window menu reaches, in the command bar's own order,
 * each with the accelerator the renderer already binds for it — shown on the
 * item so the master reads it there too, but not registered a second time. */
const WINDOWS: { name: SideWindow; accelerator?: string }[] = [
  { name: 'log', accelerator: 'CmdOrCtrl+L' },
  { name: 'reply' },
  { name: 'projects' },
  { name: 'usage' },
  { name: 'models' },
  { name: 'settings', accelerator: 'CmdOrCtrl+,' },
]

/** The same wording the renderer puts on these windows' titles and the command
 * bar's rows, kept here rather than reached for at menu-build time because the
 * main process draws no page of its own to read `text()` from. */
const LABELS: Record<'en' | 'zh-TW', Record<SideWindow, string>> = {
  en: {
    log: 'Conversation history',
    reply: 'Her answer',
    projects: 'Projects',
    usage: 'Plan usage',
    settings: 'Settings',
    models: 'Models',
  },
  'zh-TW': {
    log: '對話紀錄',
    reply: '她的回答',
    projects: '專案',
    usage: '方案用量',
    settings: '設定',
    models: '模型',
  },
}

/**
 * The application menu Electron would otherwise leave at its bare default: the
 * standard app, file, edit and view menus, and a Window menu that — beyond the usual
 * minimize and zoom — reaches every side window without going through the
 * command bar first. Rebuilt whenever the interface's language changes, since
 * the labels are drawn in it rather than read live.
 */
export function buildMenu(locale: string, openSide: (name: SideWindow) => void) {
  // Matched the way the renderer's readLocale matches, so the menu and the page agree.
  const code = locale.replace('_', '-')
  const words = LABELS[code as keyof typeof LABELS] ?? LABELS[code.split('-')[0] as keyof typeof LABELS] ?? LABELS.en
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    // Close Window (⌘W) lives here; without it no side window closes from the keyboard.
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      role: 'windowMenu',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        ...WINDOWS.map(
          ({ name, accelerator }): MenuItemConstructorOptions => ({
            label: words[name],
            accelerator,
            registerAccelerator: false,
            click: () => openSide(name),
          }),
        ),
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
