import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../../..')

/** The shared core is bundled; its prompt text is copied from the plugin's
 * source so desktop and terminal use the same instructions. */
function stagePrompts() {
  fs.rmSync(path.join(here, '../dist-electron/cafe-plugin'), { recursive: true, force: true })
  const out = path.join(here, '../dist-electron/prompts')
  fs.mkdirSync(out, { recursive: true })
  for (const name of ['greeting', 'cues']) {
    fs.copyFileSync(path.join(repo, `packages/persona-panel/prompts/${name}.md`), path.join(out, `${name}.md`))
  }
}

/**
 * The main process is bundled as ESM with the SDK left external — it ships a
 * native executable and resolves files next to itself, so it has to stay in
 * node_modules. The preload stays CJS, which is what a sandboxed preload loads.
 *
 * `fakeSdk` builds a second main process instead, with the Agent SDK aliased
 * to the e2e stand-in (see e2e/fake-sdk.ts) rather than left external — that
 * build is what Playwright launches, so the suite never dials the real Claude.
 */
export async function buildElectron({ fakeSdk = false } = {}) {
  stagePrompts()
  // The main process resolves them next to itself, bundled or not. Two icons:
  // the maid facing the master is the app, and the same maid looking away,
  // thinking, is the checkout — a different pose rather than a mark on the same
  // one, because in the Dock at that size a mark is not something you notice.
  fs.copyFileSync(path.join(here, '../assets/app-icon.png'), path.join(here, '../dist-electron/app-icon.png'))
  fs.copyFileSync(path.join(here, '../assets/app-icon-dev.png'), path.join(here, '../dist-electron/app-icon-dev.png'))

  await build({
    entryPoints: ['electron/main.ts'],
    outfile: fakeSdk ? 'dist-electron/main.e2e.mjs' : 'dist-electron/main.mjs',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: true,
    ...(fakeSdk
      ? { external: ['electron'], alias: { '@anthropic-ai/claude-agent-sdk': path.join(here, '../e2e/fake-sdk.ts') } }
      : { external: ['electron', '@anthropic-ai/claude-agent-sdk'] }),
  })

  await build({
    entryPoints: ['electron/preload.ts'],
    outfile: 'dist-electron/preload.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    sourcemap: true,
    external: ['electron'],
  })
}

if (import.meta.url === `file://${process.argv[1]}`) await buildElectron({ fakeSdk: process.argv.includes('--fake-sdk') })
