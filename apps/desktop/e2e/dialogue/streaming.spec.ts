import { expect } from '@playwright/test'
import { clickCafe, test, waitForLine } from '../launchCafe'

test('partial text appears before the final assistant message without replaying streamed blocks', async ({ cafe: { app, page } }) => {
  await page.getByPlaceholder('Say something to ことね…').fill('stream regression')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  // The fake SDK pauses after a realistic content_block_delta. Seeing this
  // while the fake turn is still gated proves this is a live partial, not the
  // complete assistant message being rendered quickly.
  const first = await waitForLine(page, 'First streamed block')
  await expect(first).not.toContainText('complete')
  await expect(page.getByText('Second streamed block', { exact: false })).toHaveCount(0)

  await app.evaluate(() => process.emit('e2e:stream:continue'))
  await expect(first).toContainText('First streamed block complete')

  // The two SDK text blocks become separate scene lines. Turning the page
  // between them also checks that completion of the stream does not replace
  // the currently displayed partial line or skip its queued successor.
  await expect(page.getByRole('button', { name: /more lines?/ })).toBeVisible()
  await page.keyboard.press(' ')
  const second = await waitForLine(page, 'Second streamed block')
  await expect(first).toHaveCount(0)
  await expect(second).toBeVisible()

  // Advancing once more must not reveal an assistant/result replay of either
  // block. There is no further line queued by this turn.
  await expect(page.getByRole('button', { name: /more lines?/ })).toHaveCount(0)

  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = await opening
  await expect(log.getByText('First streamed block complete', { exact: true })).toHaveCount(1)
  await expect(log.getByText('Second streamed block', { exact: true })).toHaveCount(1)
})
