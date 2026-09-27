import { Menu, type MenuItemConstructorOptions } from 'electron'
import type { SideWindow } from '../src/agent/bridge'
import { WINDOW_KEYS } from '../src/agent/windowKeys'

/** The same wording the renderer puts on these windows' titles,
 * kept here rather than reached for at menu-build time because the
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
 * minimize and zoom — reaches every café window. Rebuilt whenever the interface's language changes, since
 * the labels are drawn in it rather than read live.
 */
export function buildMenu(locale: string, openWindow: (name: SideWindow | null) => void) {
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
        ...WINDOW_KEYS.map(
          ({ window: name, accelerator }): MenuItemConstructorOptions => ({
            label: name ? words[name] : words === LABELS['zh-TW'] ? '女僕主畫面' : 'Maid',
            accelerator,
            click: () => openWindow(name),
          }),
        ),
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
