import { expect } from '@playwright/test'
import { clickCafe, test } from '../launchCafe'

test('keeps an older log position until the reader chooses to follow new messages', async ({ cafe: { app, page } }) => {
  const main = await app.browserWindow(page)
  await main.evaluate((window) => {
    window.webContents.send('cafe:event', {
      kind: 'backlog', sessionId: 'log-reading',
      lines: Array.from({ length: 40 }, (_, index) => ({
        role: 'assistant', content: `Historical reply ${index + 1}\n\nA paragraph to read at leisure.`, at: index * 1000,
      })),
    })
  })
  const opening = app.waitForEvent('window')
  await clickCafe(page.getByRole('button', { name: 'Open conversation history' }))
  const log = await opening
  const scroll = log.locator('main > .overflow-y-auto')
  const bottomGap = () => scroll.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)
  await expect.poll(bottomGap).toBeLessThan(3)
  await scroll.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')) })

  await main.evaluate((window) => {
    window.webContents.send('cafe:event', {
      kind: 'ambient-message', message: { type: 'text_stream', id: 'while-reading', text: 'New streamed reply', done: false },
    })
  })
  await expect(log.getByText('New streamed reply', { exact: true })).toHaveCount(1)
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0)

  await clickCafe(log.getByRole('button', { name: 'Jump to latest', exact: true }))
  await expect.poll(bottomGap).toBeLessThan(3)
  await main.evaluate((window) => {
    window.webContents.send('cafe:event', {
      kind: 'ambient-message',
      message: { type: 'text_stream', id: 'while-reading', text: 'New streamed reply\n\nNow complete.', done: true },
    })
  })
  await expect(log.getByText('Now complete.', { exact: true })).toHaveCount(1)
  await expect.poll(bottomGap).toBeLessThan(3)
})
