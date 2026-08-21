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

/**
 * Whose persona travels with the app: whoever the window has artwork for.
 *
 * Read off the sprites rather than listed again here, because the two have to
 * agree — a maid the window can stand up but has no persona for would answer as
 * a plain assistant wearing her face, and a persona for a maid nobody can pick
 * is dead weight. scripts/pack-sprites.sh is what fills that folder.
 */
const CAST = whoIsDrawn()

function whoIsDrawn() {
  const drawn = path.join(here, '../src/assets/cast')
  const found = fs.existsSync(drawn)
    ? fs.readdirSync(drawn, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    : []
  // Loudly, because the artwork is generated rather than checked in: an empty
  // folder would otherwise ship an app with nobody's persona in it, which
  // starts up fine and answers as a plain assistant.
  if (found.length === 0) throw new Error('No cast artwork staged — run apps/desktop/scripts/pack-sprites.sh first')
  return found
}

function stageCafePlugin() {
  const out = path.join(here, '../dist-electron/cafe-plugin')
  fs.rmSync(out, { recursive: true, force: true })
  fs.cpSync(path.join(repo, 'packages/cafe'), out, {
    recursive: true,
    filter: (source) => !SKIP.has(path.basename(source)),
  })
  // They live in the plugin's own maids/ folder, where the persona lookup falls
  // back to — a master who hired one of them himself still wins, which is the
  // same file. Everyone the window carries artwork for has to be here: a maid
  // who can be stood up but has no persona would answer as a plain assistant
  // wearing her face.
  for (const maid of CAST) {
    fs.copyFileSync(
      path.join(repo, `packages/characters/${maid}/persona.zh.md`),
      path.join(out, `maids/${maid}.md`),
    )
  }
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
 *
 * `fakeSdk` builds a second main process instead, with the Agent SDK aliased
 * to the e2e stand-in (see e2e/fake-sdk.ts) rather than left external — that
 * build is what Playwright launches, so the suite never dials the real Claude.
 */
export async function buildElectron({ fakeSdk = false } = {}) {
  stageCafePlugin()
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
