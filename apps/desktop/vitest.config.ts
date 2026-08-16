import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The real electron module only exists inside an Electron process; tests
      // run in plain node, so the stub answers the few calls the code makes.
      electron: path.resolve(__dirname, './test/electron-stub.ts'),
    },
  },
  test: {
    // Node by default — the main-process modules are the bulk of the pure
    // logic. Renderer tests opt into jsdom with `// @vitest-environment jsdom`.
    environment: 'node',
    // Vitest's own default include already matches *.spec.ts — Playwright's
    // specs live under the same rules and belong to `pnpm test:e2e` instead.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
