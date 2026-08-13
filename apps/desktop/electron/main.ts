import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain } from 'electron'
import { MaidSession } from './maid'

const here = path.dirname(fileURLToPath(import.meta.url))

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
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset',
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
  window.on('closed', () => session.close())

  const devServer = process.env.VITE_DEV_SERVER_URL
  if (devServer) {
    void window.loadURL(devServer)
    window.webContents.openDevTools({ mode: 'detach' })
  } else {
    void window.loadFile(path.join(here, '../dist/index.html'))
  }
}

void app.whenReady().then(openWindow)

app.on('window-all-closed', () => app.quit())
