import { expect } from '@playwright/test'
import { clickCafe, test } from '../launchCafe'

test('model and effort selection live in a separate window and update the scene', async ({ cafe: { app, page } }) => {
  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: /Model.*Effort/i }))
  const models = await opening
  await expect(models.getByRole('heading', { name: 'Model', level: 1, exact: true })).toBeVisible()

  await models.getByRole('button', { name: 'Opus', exact: true }).click()
  await expect(page.getByRole('button', { name: /Model.*Effort/i })).toContainText('Opus')
  await models.getByRole('button', { name: 'max', exact: true }).click()
  await expect(page.getByRole('button', { name: /Model.*Effort/i })).toContainText('max')

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', metaKey: true, shiftKey: true, bubbles: true, cancelable: true })))
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
