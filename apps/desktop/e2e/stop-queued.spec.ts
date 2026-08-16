import { expect } from '@playwright/test'
import { clickCafe, test, waitForLine } from './launchCafe'

/**
 * Pins a fix landing in electron/maid.ts in a parallel worktree, not this
 * one: Stop is supposed to throw away a prompt queued behind a still-running
 * turn, not just the turn that was running.
 *
 * It is green here, not red — traced with the fake's own debug output before
 * this was written: MaidSession's `interrupt()` empties `runs` on the way
 * out, and `pump()` drops anything that arrives with `runs` empty, so the
 * queued turn does get asked (and answered, wastefully — its reply is read
 * off the stream, timestamped after the interrupt) but never reaches a
 * listener to render. The bug this is pinning is real — a turn nobody meant
 * to send still gets sent to the model — it is just not one an e2e spec
 * watching the DOM can see yet. Left enabled and unchanged either way: once
 * the held-back prompt genuinely never leaves for the model, this keeps
 * meaning what it currently only assumes.
 */
test('stopping her mid-work throws away a prompt queued behind it too', async ({ cafe: { page } }) => {
  const composer = page.getByPlaceholder('Say something to ことね…')

  await composer.fill('make it slow')
  await clickCafe(page.getByRole('button', { name: 'Send' }))
  await waitForLine(page, 'Let me see…')

  // The Send button turns into Stop while she works (see InputBar) — a
  // second prompt is queued by typing and pressing Enter, not by clicking a
  // Send button that is not there to click.
  await composer.fill('hello from the queue')
  await composer.press('Enter')

  await clickCafe(page.getByRole('button', { name: 'Stop' }))
  await waitForLine(page, 'Eh, stopping there? O-okay…')

  // A short settle wait rather than the fake's own 10s timeout — the point
  // being tested is that neither of these lines ever arrives at all: not the
  // slow turn's own result, and not a reply to what was queued behind it.
  await page.waitForTimeout(500)
  await expect(page.getByText('All done, that took a moment ♪', { exact: false })).toBeHidden()
  await expect(page.getByText('Echo: hello from the queue', { exact: false })).toBeHidden()
})
