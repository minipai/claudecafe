import { expect } from '@playwright/test'
import { test } from './launchCafe'

test('her window comes up, greets him, and stands there', async ({ cafe: { page } }) => {
  await expect(page.getByText('Goshujin-sama', { exact: false }).first()).toBeVisible()
  await expect(page.getByAltText('ことね')).toBeVisible()
})
