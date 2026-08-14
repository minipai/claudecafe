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
  dropShiftHook(out)
}

/**
 * Who she is does not travel through a hook here. The plugin draws a maid at
 * session start and injects her persona from python; the window already knows —
 * the sprite is ことね — so the app puts her persona in the session's system
 * prompt itself (see maid.ts), which still stands on a Mac with no python3 for
 * the hooks to run on. This copy therefore loses that one hook, or she would be
 * introduced twice on the machines that do have one.
 *
 * Everything else in the plugin stays: the greeting, the per-turn time, the
 * mirror and the diary are what the café is, and they degrade quietly.
 */
function dropShiftHook(out) {
  const file = path.join(out, 'hooks/hooks.json')
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
 */
export async function buildElectron() {
  stageCafePlugin()
  // The main process resolves them next to itself, bundled or not. Two icons:
  // the maid facing the master is the app, and the same maid looking away,
  // thinking, is the checkout — a different pose rather than a mark on the same
  // one, because in the Dock at that size a mark is not something you notice.
  fs.copyFileSync(path.join(here, '../assets/app-icon.png'), path.join(here, '../dist-electron/app-icon.png'))
  fs.copyFileSync(path.join(here, '../assets/app-icon-dev.png'), path.join(here, '../dist-electron/app-icon-dev.png'))

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
