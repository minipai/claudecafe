import { expect } from '@playwright/test'
import { clickCafe, test } from './launchCafe'

test('a prompt comes back as a spoken line, the mood signed only in the log', async ({ cafe: { app, page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('hello there')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  // Her own line, typed into the box, is clean prose — the marker that picked
  // her expression was already taken off it by the time it got here.
  await expect(page.getByText('Echo: hello there', { exact: true })).toBeVisible()

  // The status plate sums the latest assistant message’s input and cache usage.
  await expect(page.getByText('1.5k', { exact: true })).toBeVisible()

  // The record keeps what she actually wrote, marker and all — in a window of
  // its own beside her.
  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = await opening
  const entry = log.getByText('Echo: hello there', { exact: false })
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('開心')
})
