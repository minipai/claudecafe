import { expect } from '@playwright/test'
import { clickCafe, test, waitForLine } from './launchCafe'

test('stopping her mid-work frees the input for the next prompt', async ({ cafe: { page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('make it slow')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  // Clicking Stop before the prompt has even crossed IPC tests nothing but
  // the button itself — the fake's slow turn may never have started, and the
  // interrupt path goes untested along with it. 'Let me see…' is the fake's
  // own tell that it has read the prompt (see workSlowly in fake-sdk.ts), so
  // Stop only happens once there is something real to stop.
  await waitForLine(page, 'Let me see…')
  await clickCafe(page.getByRole('button', { name: 'Stop' }))

  // Whatever she was saying when she was cut off may still be on screen —
  // the interrupted line queues up behind it.
  await waitForLine(page, 'Eh, stopping there? O-okay…')
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()

  // The turn she was stopped mid-way through must never get to finish. A
  // short settle wait rather than the fake's own 10s timeout, since the
  // point being tested is that this line never arrives at all.
  await page.waitForTimeout(500)
  await expect(page.getByText('All done, that took a moment ♪', { exact: false })).toBeHidden()

  // The interrupt-then-new-prompt path, through the real IPC and MaidSession.
  await page.getByPlaceholder('Say something to ことね…').fill('hello')
  await clickCafe(page.getByRole('button', { name: 'Send' }))
  await expect(page.getByText('Echo: hello', { exact: true })).toBeVisible()
})
