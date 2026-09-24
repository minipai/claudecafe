import { expect } from '@playwright/test'
import { test } from './launchCafe'

test('⌘, opens the settings beside her, and a language picked there redraws both windows', async ({ cafe: { app, page } }) => {
  // Dispatched straight at the window, for the same reason as ⌘⇧P in command-bar.spec.ts.
  const opening = app.waitForEvent('window')
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', metaKey: true, bubbles: true, cancelable: true })))
  const settings = await opening

  await expect(settings.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await settings.getByRole('button', { name: '繁體中文' }).first().click()

  await expect(settings.getByRole('heading', { name: '設定' })).toBeVisible()
  await expect(page.getByPlaceholder('Say something to ことね…')).toBeHidden()
})
