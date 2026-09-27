import { expect } from '@playwright/test'
import { clickCafe, test } from '../launchCafe'

test('logs manual and automatic compaction once without adding reply pages', async ({ cafe: { app, page } }) => {
  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = await opening

  await clickCafe(log.getByRole('button', { name: 'Compact', exact: true }))
  await expect(log.getByText('Manual · 12000 → 3000 tokens · 2.5s', { exact: true })).toHaveCount(1)
  await expect(log.getByText(/^COMPACTED ·/)).toHaveCount(1)
  await expect(page.getByLabel('Message 1 of 1', { exact: true })).toBeVisible()

  await page.getByPlaceholder('Say something to ことね…').fill('auto compact')
  await clickCafe(page.getByRole('button', { name: 'Send', exact: true }))
  await expect(log.getByText('Automatic · 12000 → 3000 tokens · 2.5s', { exact: true })).toHaveCount(1)
  await expect(log.getByText(/^COMPACTED ·/)).toHaveCount(2)
  await expect(page.getByText('Echo: auto compact 【 開心 ＼(ˆ ᗜ ˆ)／ 】', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Message 1 of 1', { exact: true })).toBeVisible()
})

test('restores compaction details without treating a boundary as a reply', async ({ cafe: { app, page } }) => {
  const main = await app.browserWindow(page)
  await main.evaluate((window) => {
    window.webContents.send('cafe:event', {
      kind: 'backlog', sessionId: 'compacted-history',
      lines: [
        { role: 'assistant', content: 'Earlier reply', at: 1000 },
        { role: 'boundary', content: 'Context compacted', at: 2000, compact: { trigger: 'auto', preTokens: 9000 } },
        { role: 'assistant', content: 'Later reply', at: 3000 },
      ],
    })
  })
  await expect(page.getByLabel('Message 2 of 2', { exact: true })).toBeVisible()
  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = await opening
  await expect(log.getByText(/^COMPACTED ·/)).toHaveCount(1)
  await expect(log.getByText('Automatic · 9000 tokens before', { exact: true })).toBeVisible()
})
