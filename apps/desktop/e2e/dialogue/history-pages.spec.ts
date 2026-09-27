import { expect } from '@playwright/test'
import { clickCafe, test } from '../launchCafe'

test('counts replies across prompts and lets the reader return to an earlier turn', async ({ cafe: { page } }) => {
  const composer = page.getByPlaceholder('Say something to ことね…')
  for (const [index, prompt] of ['first turn', 'second turn'].entries()) {
    await composer.fill(prompt)
    await clickCafe(page.getByRole('button', { name: 'Send', exact: true }))
    await expect(page.getByText(`Echo: ${prompt} 【 開心 ＼(ˆ ᗜ ˆ)／ 】`, { exact: true })).toBeVisible()
    await expect(page.getByLabel(`Message ${index + 1} of ${index + 1}`, { exact: true })).toBeVisible()
  }

  await clickCafe(page.getByRole('button', { name: 'Previous message', exact: true }))
  await expect(page.getByLabel('Message 1 of 2', { exact: true })).toBeVisible()
  await expect(page.getByText('Echo: first turn 【 開心 ＼(ˆ ᗜ ˆ)／ 】', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Read new message', exact: true })).toHaveCount(0)
  await expect(composer).toBeEditable()
  await composer.fill('draft')
  await page.keyboard.press('Space')
  await expect(composer).toHaveValue('draft ')
  await expect(page.getByLabel('Message 1 of 2', { exact: true })).toBeVisible()
  await page.keyboard.press('Meta+]')
  await expect(page.getByLabel('Message 2 of 2', { exact: true })).toBeVisible()
  await expect(composer).toBeEditable()
})

test('restores every historical reply and starts at the latest without forcing rereading', async ({ cafe: { app, page } }) => {
  const main = await app.browserWindow(page)
  await main.evaluate((window) => {
    window.webContents.send('cafe:event', {
      kind: 'backlog',
      sessionId: 'restored-conversation',
      lines: Array.from({ length: 5 }, (_, index) => [
        { role: 'user', content: `Question ${index + 1}`, at: index * 2 },
        { role: 'assistant', content: `Historical reply ${index + 1}`, at: index * 2 + 1 },
      ]).flat(),
    })
  })

  await expect(page.getByLabel('Message 5 of 5', { exact: true })).toBeVisible()
  await expect(page.getByText('Historical reply 5', { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Say something to ことね…')).toBeEditable()
  await expect(page.getByRole('button', { name: 'Read new message', exact: true })).toHaveCount(0)
  await clickCafe(page.getByRole('button', { name: 'Previous message', exact: true }))
  await expect(page.getByLabel('Message 4 of 5', { exact: true })).toBeVisible()
  await expect(page.getByText('Historical reply 4', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Read new message', exact: true })).toHaveCount(0)
  await expect(page.getByPlaceholder('Say something to ことね…')).toBeEditable()

  await main.evaluate((window) => {
    window.webContents.send('cafe:event', {
      kind: 'ambient-message',
      message: { type: 'text_delta', text: 'A genuinely new reply' },
    })
  })
  const readNew = page.getByRole('button', { name: 'Read new message', exact: true })
  await expect(readNew).toBeFocused()
  await expect(page.getByLabel('Message 4 of 6', { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Say something to ことね…')).not.toBeEditable()
  await page.keyboard.press('Space')
  await expect(page.getByLabel('Message 6 of 6', { exact: true })).toBeVisible()
  await expect(page.getByText('A genuinely new reply', { exact: true })).toBeVisible()
  await expect(readNew).toHaveCount(0)
  await expect(page.getByPlaceholder('Say something to ことね…')).toBeFocused()
})
