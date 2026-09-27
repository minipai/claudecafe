import { expect } from '@playwright/test'
import { clickCafe, test } from '../launchCafe'

test('renders model Markdown safely in the scene and log', async ({ cafe: { app, page } }) => {
  const main = await app.browserWindow(page)
  await main.evaluate((window) => {
    window.webContents.send('cafe:event', {
      kind: 'backlog', sessionId: 'safe-markdown',
      lines: [{
        role: 'assistant', at: 1000, laidOut: true,
        content: '**Readable reply**\n\n<img src="data:," onerror="window.__unsafeMarkdown = true">\n\n<a href="javascript:window.__unsafeMarkdown=true">Bad link</a>\n\n<script>window.__unsafeMarkdown = true</script>',
      }],
    })
  })
  const sceneReply = page.locator('.dialogue-card')
  await expect(sceneReply.locator('strong')).toHaveText('Readable reply')
  await expect(sceneReply.locator('[onerror], script, [href^="javascript:"]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__unsafeMarkdown)).toBeUndefined()

  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = await opening
  await expect(log.locator('strong')).toHaveText('Readable reply')
  await expect(log.locator('[onerror], main script, [href^="javascript:"]')).toHaveCount(0)
  expect(await log.evaluate(() => (window as unknown as Record<string, unknown>).__unsafeMarkdown)).toBeUndefined()
})
