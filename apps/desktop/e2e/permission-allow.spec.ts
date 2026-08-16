import { expect } from '@playwright/test'
import { clickCafe, test, waitForLine } from './launchCafe'

test('allowing a tool call lets the run finish', async ({ cafe: { page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('please ask permission')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  await expect(page.getByText('Say hello', { exact: true })).toBeVisible()
  await clickCafe(page.getByRole('button', { name: 'Allow', exact: true }))

  // What she says next queues up behind the ask she just answered.
  await waitForLine(page, 'Done, the command ran ♪')
})
