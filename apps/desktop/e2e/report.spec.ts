import { expect } from '@playwright/test'
import { clickCafe, test } from './launchCafe'

test('a long answer hands over a report behind a link', async ({ cafe: { page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('write report')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  const cta = page.getByRole('button', { name: 'Read the report →' })
  await expect(cta).toBeVisible()
  await clickCafe(cta)

  await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible()

  // Click outside the panel: it folds back down, and the link to reopen it stays.
  await page.mouse.click(10, 10)
  await expect(page.getByRole('heading', { name: 'Report' })).toBeHidden()
  await expect(cta).toBeVisible()
})
