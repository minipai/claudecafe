import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, nativeImage, Notification, screen, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { MaidSession } from './maid'
import {
  chosenLocale,
  lastBounds,
  recentFolders,
  rememberBounds,
  rememberFolder,
  rememberLocale,
  rememberSpeech,
} from './history'
import type { Attachment } from '../src/agent/types'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Her, in the Dock. Run from a checkout there is no bundle to take an icon
 * from, so the app sets its own — otherwise she stands there as Electron. */
const ICON = path.join(here, 'app-icon.png')

/** One window, one maid — she is sent to a folder rather than copied onto it,
 * so switching replaces the shift this window is watching. */
const shifts = new Map<Electron.WebContents, MaidSession>()

function readFolderArg() {
  const flag = process.argv.find((arg) => arg.startsWith('--dir='))
  return flag ? path.resolve(flag.slice('--dir='.length)) : null
}

function openWindow(cwd: string) {
  const window = new BrowserWindow({
    width: 960,
    height: 800,
    ...whereSheStood(),
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
      additionalArguments: [
        `--cafe-cwd=${cwd}`,
        `--cafe-locale=${drawnIn()}`,
        `--cafe-locale-choice=${chosenLocale()}`,
      ],
    },
  })

  startShift(window, cwd)

  // Where she is put down is written as it happens, not only on the way out —
  // after a force-quit is exactly when coming back to the middle of the screen
  // is most annoying. Carrying her moves the window sixty times a second, so
  // the note waits for her to be set down rather than following her across.
  let settling: NodeJS.Timeout | null = null
  const noteFrame = () => {
    if (settling) clearTimeout(settling)
    settling = setTimeout(() => rememberBounds(window.getBounds()), 400)
  }
  window.on('moved', noteFrame)
  window.on('resized', noteFrame)
  window.on('close', () => {
    if (settling) clearTimeout(settling)
    rememberBounds(window.getBounds())
  })

  window.on('closed', () => {
    shifts.get(window.webContents)?.close()
    shifts.delete(window.webContents)
    stopCarrying(window)
  })

  const devServer = process.env.VITE_DEV_SERVER_URL
  if (devServer) {
    void window.loadURL(devServer)
    window.webContents.openDevTools({ mode: 'detach' })
  } else {
    void window.loadFile(path.join(here, '../dist/index.html'))
  }
}

/**
 * The frame she was last left in, if it is still somewhere the master can see:
 * a position saved on a monitor that has since been unplugged would put her off
 * the edge of the desktop, and only the size survives that.
 */
function whereSheStood() {
  const saved = lastBounds()
  if (!saved) return {}
  const onScreen = screen.getAllDisplays().some(({ workArea: area }) =>
    saved.x < area.x + area.width &&
    saved.x + saved.width > area.x &&
    saved.y < area.y + area.height &&
    saved.y + saved.height > area.y,
  )
  return onScreen ? saved : { width: saved.width, height: saved.height }
}

/** Put a maid on this folder in this window, replacing whoever was on it. */
function startShift(window: BrowserWindow, cwd: string) {
  shifts.get(window.webContents)?.close()
  const session = new MaidSession(cwd, (event) => {
    if (!window.isDestroyed()) window.webContents.send('cafe:event', event)
  })
  shifts.set(window.webContents, session)
  rememberFolder(cwd)
  return session
}

/** The language code the interface is drawn in. `system` means whatever the
 * machine is set to, which is what a window handed to someone else should do
 * before being told otherwise. */
function drawnIn() {
  const choice = chosenLocale()
  return choice === 'system' ? app.getLocale() : choice
}

/** Which maid the window that sent this is talking to. */
const shiftOf = (event: IpcMainEvent | IpcMainInvokeEvent) => shifts.get(event.sender)
const windowOf = (event: IpcMainEvent) => BrowserWindow.fromWebContents(event.sender)

ipcMain.on('cafe:start', (event, runId: string, prompt: string, images: Attachment[]) =>
  shiftOf(event)?.ask(runId, prompt, images),
)
ipcMain.on('cafe:answer', (event, askId: string, value: unknown) => shiftOf(event)?.answer(askId, value))
ipcMain.on('cafe:interrupt', (event) => shiftOf(event)?.interrupt())
ipcMain.on('cafe:new-session', (event) => shiftOf(event)?.reset())
ipcMain.on('cafe:refresh', (event) => shiftOf(event)?.refresh())
ipcMain.on('cafe:configure', (event, patch) => shiftOf(event)?.configure(patch))
ipcMain.on('cafe:resume', (event, sessionId: string) => shiftOf(event)?.resume(sessionId))
ipcMain.handle('cafe:usage', (event) => shiftOf(event)?.usage() ?? null)
ipcMain.handle('cafe:context', (event) => shiftOf(event)?.context() ?? null)
ipcMain.handle('cafe:agents', (event) => shiftOf(event)?.agents() ?? [])
ipcMain.handle('cafe:mcp', (event) => shiftOf(event)?.mcpServers() ?? [])
ipcMain.handle('cafe:status', (event) => shiftOf(event)?.status() ?? null)
ipcMain.handle('cafe:conversations', (event) => shiftOf(event)?.conversations() ?? [])
ipcMain.handle('cafe:folders', () => recentFolders())

/** Another language for the interface. Nothing reopens: the window redraws, and
 * the choice is kept for the next start. */
ipcMain.on('cafe:set-locale', (event, choice: string) => {
  rememberLocale(choice)
  windowOf(event)?.webContents.send('cafe:event', { kind: 'locale', locale: drawnIn(), choice })
})

/** Another language for her — free text, empty to follow the café's setting. */
ipcMain.on('cafe:set-speech', (event, language: string) => {
  rememberSpeech(language)
  shiftOf(event)?.speakIn()
})

/** Somewhere else to work. The window stays; what is in it starts over on the
 * new folder, with whatever was last said there. */
ipcMain.on('cafe:switch-folder', (event, cwd: string) => {
  const window = windowOf(event)
  if (window) startShift(window, cwd).refresh()
})

/** A folder she has never been to. Same window: she is sent, not cloned. */
ipcMain.handle('cafe:open-folder', async (event) => {
  const asking = BrowserWindow.fromWebContents(event.sender)
  const picked = await dialog.showOpenDialog(asking!, {
    // Dotted folders are shown: plenty of what she is asked to work on lives in
    // one — ~/.claude above all — and the panel hides them otherwise.
    properties: ['openDirectory', 'showHiddenFiles', 'createDirectory'],
    title: 'Send her to another folder',
  })
  if (picked.canceled || !picked.filePaths[0] || !asking) return null
  startShift(asking, picked.filePaths[0]).refresh()
  return picked.filePaths[0]
})

/**
 * She is standing on the desktop, not in a terminal: when the master is looking
 * elsewhere and she finishes — or stops, needing an answer — she says so where
 * he is. Nothing is sent while the window is in front of him; he can see her.
 */
ipcMain.on('cafe:notify', (event, body: string, waiting: boolean) => {
  const window = windowOf(event)
  if (!window || window.isFocused()) return
  const note = new Notification({ title: waiting ? 'ことね is waiting' : 'ことね', body })
  note.on('click', () => {
    if (window.isDestroyed()) return
    window.show()
    window.focus()
  })
  // macOS drops notifications outright when the app has not been allowed to
  // post them — which is every run from a checkout, since that Electron was
  // never granted anything. The Dock is not blocked, so she knocks there.
  note.on('failed', () => app.dock?.bounce('informational'))
  note.show()
  // Waiting is not the same as finished: the Dock says so until he comes back.
  if (waiting) app.dock?.bounce('critical')
})

// The scene says when the pointer is over nothing; forwarding keeps the moves
// coming, which is how it knows to take the pointer back.
ipcMain.on('cafe:click-through', (event, through: boolean) => {
  windowOf(event)?.setIgnoreMouseEvents(through, { forward: true })
})

// Picking her up. The window follows the cursor from where it was grabbed,
// read from the screen rather than from mouse deltas — the window moving out
// from under the pointer would otherwise chase its own tail.
const carrying = new Map<BrowserWindow, NodeJS.Timeout>()

function stopCarrying(window: BrowserWindow) {
  const following = carrying.get(window)
  if (following) clearInterval(following)
  carrying.delete(window)
}

ipcMain.on('cafe:drag-start', (event) => {
  const window = windowOf(event)
  if (!window) return
  stopCarrying(window)
  const grabbed = screen.getCursorScreenPoint()
  const from = window.getBounds()
  carrying.set(
    window,
    setInterval(() => {
      const now = screen.getCursorScreenPoint()
      window.setPosition(from.x + now.x - grabbed.x, from.y + now.y - grabbed.y)
    }, 16),
  )
})
ipcMain.on('cafe:drag-end', (event) => {
  const window = windowOf(event)
  if (window) stopCarrying(window)
})

void app.whenReady().then(() => {
  app.dock?.setIcon(nativeImage.createFromPath(ICON))
  // Where she was left. A folder given on the command line still wins — that is
  // someone saying where to open her — and with nothing to go on she opens at
  // home rather than wherever the command happened to be run from.
  const last = recentFolders().find((folder) => existsSync(folder))
  openWindow(readFolderArg() ?? last ?? homedir())
})

app.on('window-all-closed', () => app.quit())
