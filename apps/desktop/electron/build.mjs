import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../../..')

/**
 * The Agent SDK finds its native CLI through an optional platform package.
 * pnpm keeps that package beside the SDK in its store, but electron-builder's
 * production-dependency walk does not follow that private link in a workspace.
 * Put the executable beside the bundled main process instead, where both a dev
 * build and a packaged app can address it without relying on node resolution.
 */
function stageClaudeCli() {
  const require = createRequire(import.meta.url)
  const sdk = require.resolve('@anthropic-ai/claude-agent-sdk')
  const platformPackage = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`
  const executable = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const source = createRequire(sdk).resolve(`${platformPackage}/${executable}`)
  const out = path.join(here, `../dist-electron/${executable}`)
  fs.copyFileSync(source, out)
  fs.chmodSync(out, 0o755)
}

/**
 * The café plugin travels with the app. On a terminal the maid is whoever the
 * plugin drew that day; here the app loads her persona from its configured
 * characters folder and carries its own copy of the plugin instead of
 * asking the master to install one. The copy is what the session loads, so the
 * window behaves the same on a machine that has never heard of the café.
 *
 * Skipped: the release zip and the python bytecode cache, which are the
 * plugin's own build leftovers, and the shipping script, which is ours to run.
 */
const SKIP = new Set(['dist', '__pycache__', 'ship.sh', 'test.py'])

function stageCafePlugin() {
  const out = path.join(here, '../dist-electron/cafe-plugin')
  fs.rmSync(out, { recursive: true, force: true })
  fs.cpSync(path.join(repo, 'packages/cafe'), out, {
    recursive: true,
    filter: (source) => !SKIP.has(path.basename(source)),
  })
  dropShiftHook(out)
}

/**
 * Who she is does not travel through a hook here. The plugin draws a maid at
 * session start and injects her persona from python; the window already knows —
 * from the configured character folder — so it puts her persona in the session's system
 * prompt itself (see maid.ts), which still stands on a Mac with no python3 for
 * the hooks to run on. This copy therefore loses that one hook, or she would be
 * introduced twice on the machines that do have one.
 *
 * Everything else in the plugin stays: the greeting, the per-turn time, the
 * mirror and the diary are what the café is, and they degrade quietly.
 */
function dropShiftHook(out) {
  const manifest = JSON.parse(fs.readFileSync(path.join(out, '.claude-plugin/plugin.json'), 'utf8'))
  const file = path.resolve(out, manifest.hooks ?? 'hooks/hooks.json')
  const config = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const group of config.hooks.SessionStart) {
    group.hooks = group.hooks.filter((hook) => !hook.command.includes('load-persona'))
  }
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
  fs.rmSync(path.join(out, 'hooks/load-persona.py'))
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
  stageCafePlugin()
  stageClaudeCli()
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
