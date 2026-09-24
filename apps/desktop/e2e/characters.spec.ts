import path from 'node:path'
import { expect } from '@playwright/test'
import { test } from './launchCafe'

test.describe('configured characters folder', () => {
  test.use({ maid: 'a-brand-new-maid' })

  test('discovers an unknown maid beside café settings and serves her portrait', async ({ cafe: { page, characters } }) => {
    const portrait = page.getByAltText('Folder Maid')
    await expect(portrait).toBeVisible()
    await expect(portrait).toHaveAttribute('src', /cafe-character:.*a-brand-new-maid.*portraits\/neutral.webp/)
    await expect.poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
    expect(await portrait.evaluate((image: HTMLImageElement) => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, 1, 1).data.length
    })).toBe(4)
    const cast = await page.evaluate(() => window.cafe!.cast())
    expect(cast.map((maid) => maid.id)).toEqual(['a-brand-new-maid', 'kotone'])
    expect(characters).toContain(path.join('.config', 'claudecafe', 'characters'))
    expect(await page.evaluate(() => window.cafe!.charactersDir)).toBe(characters)
  })
})
