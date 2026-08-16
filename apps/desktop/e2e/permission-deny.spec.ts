import { expect } from '@playwright/test'
import { clickCafe, test, waitForLine } from './launchCafe'

test('denying a tool call leaves her idle again', async ({ cafe: { page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('please ask permission')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  await expect(page.getByText('Say hello', { exact: true })).toBeVisible()
  await clickCafe(page.getByRole('button', { name: 'Deny', exact: true }))

  // What she says next queues up behind the ask she just answered.
  await waitForLine(page, 'Mm, I will leave it be then~')
  // Idle again: the send button stands where the stop control was.
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
})
