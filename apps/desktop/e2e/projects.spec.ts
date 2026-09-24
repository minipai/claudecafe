import { expect } from '@playwright/test'
import { test } from './launchCafe'

test('/resume opens the projects window on the folder she is in', async ({ cafe: { app, page, project } }) => {
  const opening = app.waitForEvent('window')
  await page.getByPlaceholder('Say something to ことね…').fill('/resume')
  await page.getByPlaceholder('Say something to ことね…').press('Enter')
  const projects = await opening

  await expect(projects.getByRole('heading', { name: 'Folders' })).toBeVisible()
  await expect(projects.getByTitle(project)).toHaveAttribute('aria-pressed', 'true')
})
