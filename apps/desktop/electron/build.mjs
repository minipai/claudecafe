import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../../..')

/**
 * The café plugin travels with the app. On a terminal the maid is whoever the
 * plugin drew that day; here the sprite and the name plate are already ことね,
 * so the app carries its own copy of the plugin and her persona file instead of
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
  // She lives in the plugin's own maids/ folder, where the persona lookup falls
  // back to — a master who hired her himself still wins, which is the same file.
  fs.copyFileSync(
    path.join(repo, 'packages/maid-personas/zh/kotone.md'),
    path.join(out, 'maids/kotone.md'),
  )
}

/**
 * The main process is bundled as ESM with the SDK left external — it ships a
 * native executable and resolves files next to itself, so it has to stay in
 * node_modules. The preload stays CJS, which is what a sandboxed preload loads.
 */
export async function buildElectron() {
  stageCafePlugin()

  await build({
    entryPoints: ['electron/main.ts'],
    outfile: 'dist-electron/main.mjs',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: true,
    external: ['electron', '@anthropic-ai/claude-agent-sdk'],
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

if (import.meta.url === `file://${process.argv[1]}`) await buildElectron()
