import { expect } from '@playwright/test'
import { clickCafe, test } from './launchCafe'

test('a prompt comes back as a spoken line, the mood signed only in the log', async ({ cafe: { page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('hello there')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  // Her own line, typed into the box, is clean prose — the marker that picked
  // her expression was already taken off it by the time it got here.
  await expect(page.getByText('Echo: hello there', { exact: true })).toBeVisible()

  // The status plate's context figure is the turn's usage folded through
  // MaidSession's own accounting (input + cache read + cache creation) — the
  // fake's usage block is picked so that lands on an exact "1.5k".
  await expect(page.getByText('1.5k', { exact: true })).toBeVisible()

  // The record keeps what she actually wrote, marker and all.
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = page.getByRole('dialog')
  const entry = log.getByText('Echo: hello there', { exact: false })
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('開心')
})
