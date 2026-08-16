import { expect } from '@playwright/test'
import { clickCafe, test } from './launchCafe'

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
  await expect(page.getByText('Echo: hello again', { exact: true })).toBeVisible()
})
