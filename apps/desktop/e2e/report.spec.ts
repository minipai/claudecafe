import { expect } from '@playwright/test'
import { clickCafe, test } from './launchCafe'

test('a long answer hands over a report behind a link', async ({ cafe: { app, page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('write report')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  const cta = page.getByRole('button', { name: 'Read the report →' })
  await expect(cta).toBeVisible()
  const opening = app.waitForEvent('window')
  await clickCafe(cta)

  // It opens beside her, and the link to bring it back stays under the box.
  const report = await opening
  await expect(report.getByRole('heading', { name: 'Report' })).toBeVisible()
  await expect(cta).toBeVisible()
})
