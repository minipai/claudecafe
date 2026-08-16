import { expect } from '@playwright/test'
import { test } from './launchCafe'

test('cmd-K opens the command bar to folders and conversations, and Escape closes it', async ({ cafe: { page } }) => {
  // Playwright's own Meta+K chord never reaches the window as a real ⌘K on
  // this Electron build — the window's own listener wants `metaKey` on a
  // 'k' keydown, so that's dispatched straight at it instead.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true })))
  const bar = page.getByRole('dialog')
  await expect(bar.getByText('Work somewhere else')).toBeVisible()
  await expect(bar.getByText('Go back to a conversation')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(bar).toBeHidden()
})
