import { expect } from '@playwright/test'
import { clickCafe, test, waitForLine } from './launchCafe'

test('picking an answer to her question echoes the choice back', async ({ cafe: { page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('ask a question')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  // The question itself is the only thing on screen so far — nothing queued
  // ahead of it to click through first.
  await expect(page.getByText('Coffee or tea, Goshujin-sama?', { exact: true })).toBeVisible()
  const coffee = page.getByRole('button', { name: 'Coffee', exact: true })
  await expect(coffee).toBeVisible()
  await clickCafe(coffee)

  // Her reply queues up behind the question she just asked, the same as any
  // other line said on top of one already showing.
  await waitForLine(page, 'Noted — Coffee, then')
})
