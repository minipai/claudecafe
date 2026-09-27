import { expect } from '@playwright/test'
import { clickCafe, test } from '../launchCafe'

test('an expired OAuth session opens sign-in recovery instead of a successful command output', async ({ cafe: { page, app } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('expire login')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  const trouble = page.getByRole('dialog')
  await expect(trouble).toBeVisible()
  await expect(trouble).toContainText(/sign.?in|log.?in/i)
  await expect(trouble.getByText('claude auth login', { exact: true })).toBeVisible()
  await expect(trouble).toContainText('Failed to authenticate: OAuth session expired and could not be refreshed')
  // Simulate confirming that sign-in has been repaired, without touching real credentials.
  await clickCafe(trouble.getByRole('button', { name: 'Signed in — let her in', exact: true }))
  await expect(trouble).toBeHidden()
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible()

  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = await opening
  await expect(log.getByText('printed its own answer', { exact: false })).toHaveCount(0)

  // A fresh prompt reconnects after the user has repaired their credentials.
  // The fake SDK accepts the next prompt without touching the real login.
  await page.getByPlaceholder('Say something to ことね…').fill('hello again')
  await clickCafe(page.getByRole('button', { name: 'Send' }))
  await expect(page.getByText('Echo: hello again 【 開心 ＼(ˆ ᗜ ˆ)／ 】', { exact: true })).toBeVisible()
})

test('a dropped connection is explained, and a fresh prompt reconnects', async ({ cafe: { page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('go offline')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  const trouble = page.getByRole('dialog')
  await expect(trouble.getByText('ことね cannot reach anything')).toBeVisible()

  // MaidSession drops the connection, not the conversation — it reopens on
  // its own the next time something is asked of it (see `ask` in maid.ts),
  // so the window is still usable rather than merely still standing. The
  // panel is a modal, though, and has to be out of the way first for the
  // composer underneath it to take a click at all.
  await clickCafe(page.getByRole('button', { name: 'Close', exact: true }))
  await expect(trouble).toBeHidden()

  await page.getByPlaceholder('Say something to ことね…').fill('hello again')
  await clickCafe(page.getByRole('button', { name: 'Send' }))
  await expect(page.getByText('Echo: hello again 【 開心 ＼(ˆ ᗜ ˆ)／ 】', { exact: true })).toBeVisible()
})
