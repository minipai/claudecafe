import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, nativeImage, screen } from 'electron'
import { MaidSession } from './maid'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Her, in the Dock. Run from a checkout there is no bundle to take an icon
 * from, so the app sets its own — otherwise she stands there as Electron. */
const ICON = path.join(here, 'app-icon.png')

/** One window, one project — the folder is chosen outside the app, like a VS Code window. */
const cwd = readFolderArg() ?? process.cwd()

function readFolderArg() {
  const flag = process.argv.find((arg) => arg.startsWith('--dir='))
  return flag ? path.resolve(flag.slice('--dir='.length)) : null
}

function openWindow() {
  const window = new BrowserWindow({
    width: 960,
    height: 800,
    minWidth: 720,
    minHeight: 560,
    icon: ICON,
    // Nothing behind her at all: no frost, no plate, no window shadow to give
    // away where the empty half of the window is. What makes that liveable is
    // the pointer falling through it (see cafe:click-through below).
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    // No frame at all, so no traffic lights hanging over the desktop. She is
    // the handle: dragging her moves the window (see cafe:drag-start).
    frame: false,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      additionalArguments: [`--cafe-cwd=${cwd}`],
    },
  })

  const session = new MaidSession(cwd, (event) => {
    if (!window.isDestroyed()) window.webContents.send('cafe:event', event)
  })

  ipcMain.on('cafe:start', (_event, runId: string, prompt: string) => session.ask(runId, prompt))
  ipcMain.on('cafe:answer', (_event, askId: string, value: unknown) => session.answer(askId, value))
  ipcMain.on('cafe:interrupt', () => session.interrupt())
  ipcMain.on('cafe:new-session', () => session.reset())
  ipcMain.on('cafe:refresh', () => session.refresh())
  ipcMain.on('cafe:configure', (_event, patch) => session.configure(patch))
  ipcMain.handle('cafe:usage', () => session.usage())
  ipcMain.handle('cafe:context', () => session.context())
  ipcMain.handle('cafe:agents', () => session.agents())
  ipcMain.handle('cafe:mcp', () => session.mcpServers())
  ipcMain.handle('cafe:status', () => session.status())
  // The scene says when the pointer is over nothing; forwarding keeps the moves
  // coming, which is how it knows to take the pointer back.
  ipcMain.on('cafe:click-through', (_event, through: boolean) => {
    window.setIgnoreMouseEvents(through, { forward: true })
  })

  // Picking her up. The window follows the cursor from where it was grabbed,
  // read from the screen rather than from mouse deltas — the window moving out
  // from under the pointer would otherwise chase its own tail.
  let carrying: NodeJS.Timeout | null = null
  ipcMain.on('cafe:drag-start', () => {
    if (carrying) clearInterval(carrying)
    const grabbed = screen.getCursorScreenPoint()
    const from = window.getBounds()
    carrying = setInterval(() => {
      const now = screen.getCursorScreenPoint()
      window.setPosition(from.x + now.x - grabbed.x, from.y + now.y - grabbed.y)
    }, 16)
  })
  ipcMain.on('cafe:drag-end', () => {
    if (carrying) clearInterval(carrying)
    carrying = null
  })
  window.on('closed', () => carrying && clearInterval(carrying))
  window.on('closed', () => session.close())

  const devServer = process.env.VITE_DEV_SERVER_URL
  if (devServer) {
    void window.loadURL(devServer)
    window.webContents.openDevTools({ mode: 'detach' })
  } else {
    void window.loadFile(path.join(here, '../dist/index.html'))
  }
}

void app.whenReady().then(() => {
  app.dock?.setIcon(nativeImage.createFromPath(ICON))
  openWindow()
})

app.on('window-all-closed', () => app.quit())
