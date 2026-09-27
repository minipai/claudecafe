import { expect } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import { test } from '../launchCafe'

async function activateWindow(app: ElectronApplication, accelerator: string) {
  await app.evaluate(({ Menu }, key) => {
    const find = (items: Electron.MenuItem[]): Electron.MenuItem | undefined => {
      for (const item of items) {
        if (item.accelerator === key) return item
        const nested = item.submenu && find(item.submenu.items)
        if (nested) return nested
      }
    }
    find(Menu.getApplicationMenu()!.items)!.click()
  }, accelerator)
}

test('⌘, opens the settings beside her, and a language picked there redraws both windows', async ({ cafe: { app, page } }) => {
  const opening = app.waitForEvent('window')
  await activateWindow(app, 'CmdOrCtrl+,')
  const settings = await opening

  await expect(settings.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await settings.getByRole('button', { name: '繁體中文' }).first().click()

  await expect(settings.getByRole('heading', { name: '設定' })).toBeVisible()
  await expect(page.getByPlaceholder('Say something to ことね…')).toBeHidden()

  const logOpening = app.waitForEvent('window')
  await activateWindow(app, 'CmdOrCtrl+L')
  const log = await logOpening
  await expect(log.getByRole('heading', { name: /對話紀錄/ })).toBeVisible()

  // A shortcut from a side window reuses Settings.
  await activateWindow(app, 'CmdOrCtrl+,')
  expect(app.windows()).toHaveLength(3)
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.webContents.getURL())).toBe(settings.url())

  for (const [accelerator, target] of [
    ['CmdOrCtrl+Shift+L', 'reply'],
    ['CmdOrCtrl+Shift+O', 'projects'],
    ['CmdOrCtrl+Shift+M', 'models'],
    ['CmdOrCtrl+Shift+U', 'usage'],
  ]) {
    const opening = app.waitForEvent('window')
    await activateWindow(app, accelerator)
    const side = await opening
    await expect(side).toHaveURL(new RegExp(`window=${target}`))
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.webContents.getURL())).toBe(side.url())
    await activateWindow(app, accelerator)
  }
  expect(app.windows()).toHaveLength(7)
  await activateWindow(app, 'CmdOrCtrl+Shift+0')
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.webContents.getURL())).toBe(page.url())
  await expect(page.getByPlaceholder(/說點什麼/)).toBeVisible()
})
