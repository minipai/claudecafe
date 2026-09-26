import { expect } from '@playwright/test'
import { clickCafe, test } from '../launchCafe'

test('a prompt comes back as a spoken line, with its mood marker inline', async ({ cafe: { app, page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('hello there')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  // The streamed line is shown as she wrote it, including its mood marker.
  await expect(page.getByText('Echo: hello there 【 開心 ＼(ˆ ᗜ ˆ)／ 】', { exact: true })).toBeVisible()

  // The record keeps what she actually wrote, marker and all — in a window of
  // its own beside her.
  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = await opening
  const entry = log.getByText('Echo: hello there', { exact: false })
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('開心')
})
