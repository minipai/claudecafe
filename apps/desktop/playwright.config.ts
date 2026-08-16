import { defineConfig } from '@playwright/test'

/**
 * Launches her own Electron binary rather than a browser, so there is no
 * browser to install — `_electron.launch` drives the app the suite builds
 * with the Agent SDK swapped for a scripted fake (see e2e/fake-sdk.ts).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  // A retry on a developer's own machine hides flake instead of surfacing it;
  // CI is the only place a second, silent attempt is worth more than knowing.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  // Nothing to diagnose a failure from otherwise — a trace is the only one of
  // these that costs nothing when the run is green.
  use: { trace: 'retain-on-failure' },
})
