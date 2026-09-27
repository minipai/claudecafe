import { expect } from '@playwright/test'
import { clickCafe, test, waitForLine } from '../launchCafe'

test('streams pages live and gates draft input until Space or shortcuts reach the latest page', async ({ cafe: { app, page } }) => {
  const composer = page.getByPlaceholder('Say something to ことね…')
  await composer.fill('stream regression')
  await clickCafe(page.getByRole('button', { name: 'Send' }))

  // The fake SDK pauses after a realistic content_block_delta. Seeing this
  // while the fake turn is still gated proves this is a live partial, not the
  // complete assistant message being rendered quickly.
  const first = await waitForLine(page, 'First streamed block')
  await expect(first).not.toContainText('complete')
  await expect(page.getByText('Second streamed block', { exact: false })).toHaveCount(0)
  await composer.fill('Keep this draft')

  await app.evaluate(() => process.emit('e2e:stream:continue'))
  await expect(first).toContainText('First streamed block complete')

  // The two SDK text blocks become separate scene lines. Turning the page
  // between them also checks that completion of the stream does not replace
  // the currently displayed partial line or skip its queued successor.
  const next = page.getByRole('button', { name: 'Next message', exact: true })
  const previous = page.getByRole('button', { name: 'Previous message', exact: true })
  await expect(next).toBeEnabled()
  await expect(previous).toBeDisabled()
  await expect(page.getByLabel('Message 1 of 2', { exact: true })).toBeVisible()
  const readNext = page.getByRole('button', { name: 'Read new message', exact: true })
  await expect(readNext).toBeFocused()
  const center = await readNext.boundingBox()
  const arrow = await next.boundingBox()
  const card = await page.locator('.dialogue-card').boundingBox()
  expect(center).not.toBeNull()
  expect(arrow).not.toBeNull()
  expect(card).not.toBeNull()
  expect(Math.abs(center!.x + center!.width / 2 - (card!.x + card!.width / 2))).toBeLessThan(3)
  expect(Math.abs(center!.y + center!.height / 2 - (arrow!.y + arrow!.height / 2))).toBeLessThan(3)
  await expect(composer).not.toBeEditable()
  await expect(composer).toHaveValue('Keep this draft')
  await composer.focus()
  await page.keyboard.press('x')
  await expect(composer).toHaveValue('Keep this draft')
  await page.keyboard.press('Space')
  const second = await waitForLine(page, 'Second streamed block')
  await expect(first).toHaveCount(0)
  await expect(second).toBeVisible()
  await expect(composer).toBeEditable()
  await expect(composer).toBeFocused()
  await expect(composer).toHaveValue('Keep this draft')

  // Advancing once more must not reveal an assistant/result replay of either
  // block. There is no further line queued by this turn.
  await expect(next).toBeDisabled()
  await expect(page.getByLabel('Message 2 of 2', { exact: true })).toBeVisible()

  // Re-reading a page does not append another log entry or replay its actions.
  await page.keyboard.press('Meta+[')
  await expect(first).toContainText('First streamed block complete')
  await expect(previous).toBeDisabled()
  await expect(readNext).toHaveCount(0)
  await expect(composer).toBeEditable()
  await composer.focus()
  await page.keyboard.press('ArrowRight')
  await expect(first).toBeVisible()
  await page.keyboard.press('Meta+]')
  await expect(second).toBeVisible()
  await expect(composer).toBeFocused()
  await expect(composer).toHaveValue('Keep this draft')

  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = await opening
  await expect(log.getByText('First streamed block complete', { exact: true })).toHaveCount(1)
  await expect(log.getByText('Second streamed block', { exact: true })).toHaveCount(1)
})
