import { expect } from '@playwright/test'
import { test } from './launchCafe'

test('cmd-shift-P opens the command bar, and Escape closes it', async ({ cafe: { page } }) => {
  // Playwright's own Meta+Shift+P chord never reaches the window as a real
  // ⌘⇧P on this Electron build — the window's own listener wants `metaKey` and
  // `shiftKey` on a 'P' keydown, so that's dispatched straight at it instead.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', metaKey: true, shiftKey: true, bubbles: true, cancelable: true })))
  const bar = page.getByRole('dialog')
  await expect(bar.getByText('Projects')).toBeVisible()
  await expect(bar.getByText('Start a new conversation')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(bar).toBeHidden()
})
