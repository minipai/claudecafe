# claudecafe (monorepo)

A pnpm monorepo for the AI maid ecosystem. The repo root **is also a plugin marketplace
named `claudecafe`** (`.claude-plugin/marketplace.json`, listing the cafe plugin). Six
packages, everything with an npm package.json namespaced under `@claudecafe/*` (the
private root stays `claudecafe-monorepo`; `packages/cafe` is the Claude Code
function-hook plugin and `packages/character-core` is its shared JS core.

**Each package has its own README. Read the one you are working in** — this file is only
the things that are expensive to find out the hard way.

- **`apps/desktop`** — her window (Electron main process in `electron/`, Vite/React 19/
  Tailwind in `src/`, Agent SDK). She *is* the agent, not a client talking to one.
- **`apps/website`** — claudecafe.dev (Hono SSR): the showcase, and the hiring channel —
  `/<id>.md` serves a persona file, frontmatter included.
- **`packages/characters`** — the cast. One folder per maid: persona per language,
  root `avatar.webp`, default `portraits/` and `pixels/`, and optional `variants/`.
  **The PNG masters, pencil references and drawing spec live in `art-masters/` at the
  repo root, gitignored** — the art scripts read from there and stop with a plain error
  when it isn't present.
- **`packages/cafe`** — the Claude Code plugin. Its `hooks/hooks.json` is a
  modules-only function profile; `scripts/build-cafe-function.sh` bundles the
  shared `packages/character-core` contracts and the panel adapter into the
  checked-in runtime module. It shares the café data root at
  `$XDG_CONFIG_HOME/claudecafe` (default `~/.config/claudecafe`).
- **`packages/opencode`** — the café for OpenCode, with the sidebar portrait and
  character-pack sync sharing `packages/character-core`. One package, two
  entrypoints (`exports["./server"]` and `exports["./tui"]`) because OpenCode's
  loader refuses a module that default-exports both. It shares the café data root
  and reads `packages/cafe`'s prompts and nameless maid. Server hooks run inside
  OpenCode's own Bun runtime.

## ⚠️ Three landmines in plugin development

- **Claude function hooks are engine-loaded**: `packages/cafe/hooks/hooks.json`
  points at a bundled ESM module and must not shell out to `node`, `bun`, or
  `python3`. The checked-in `register.generated.js` is produced by
  `scripts/build-cafe-function.sh`; OpenCode runs its own TypeScript/Bun adapter.
- **Always bump the version when you change a plugin**: `/plugin update` compares versions
  and won't reinstall an unchanged one. Bump `packages/cafe/.claude-plugin/plugin.json` and
  the matching entry in the root `marketplace.json` together, then
  `/plugin marketplace update claudecafe` → `/plugin update cafe@claudecafe`.
- **Ask the user before touching live global config (`~/.config/claudecafe/` or `~/.claude/`).** The plugin is
  installed + enabled from the marketplace — there are no loose hook mirrors or symlinks,
  and none should be laid down by hand again.

The mood marker is **emit-only**: the `【…】` at the end of a reply is pure style; no Stop hook
or status line reads it.

## Workspace

- pnpm workspace (`pnpm-workspace.yaml` → `apps/*`, `packages/*`), **one lockfile** at the
  root.
- `pnpm install`, `pnpm dev:web`, `pnpm -r check`,
  `pnpm --filter @claudecafe/website ship`.

## apps/desktop

- **The main process ignores HMR**: any change under `electron/` (SDK session, tools, look
  watcher, ipc) needs the dev app restarted — `node electron/dev.mjs` (**never pass
  `--dir=`**, it overwrites the folder she remembers). Only `src/` updates live.
- **The packaged build is the one the user actually uses**
  (`release/mac-arm64/ClaudeCafe.app`) and keeps separate state from the dev build
  (`ClaudeCafe` vs `ClaudeCafe (dev)` under Application Support). Leave it alone when
  restarting dev.
- **The cast is discovered at runtime**: the desktop app reads
  `$XDG_CONFIG_HOME/claudecafe/characters` (default `~/.config/claudecafe/characters`),
  with a persona, optional `avatar.webp`, and `portraits/neutral.webp`
  per maid. It does not bundle a fixed cast or offer outfit selection.
- **Language split**: the interface is English, but what she says follows the user's
  language — the lines the window feeds her are generated once at startup per the café
  config's `lang` into `lines.json` under userData (`electron/lines.ts`).
- Releasing: `scripts/ship.sh` → bump the version in `apps/website/src/pages/AppPage.tsx`
  by hand → ship the site.
- What's still missing before handing it to a stranger is tracked in `notes/`, not in git.

## apps/website

- It runs as a **Cloudflare Worker** (`wrangler.jsonc`): no filesystem at runtime, so no
  `node:fs` under `src/`. `scripts/build-cast.ts` parses the persona files into
  `src/cast.json` (gitignored) before bundling; `wrangler dev` reruns it when the cast changes.
  `public/` is served as static assets in front of the Worker.
- **i18n**: English at the root, Chinese under `/zh/`; `href()` in `src/i18n.ts` builds every
  URL. English content is a translation file beside the Chinese one (`persona.en.md`),
  falling back to the Chinese version when missing.
- The site no longer serves a blog. The posts are kept in `packages/blog/`
  (writing style guide: `packages/blog/CLAUDE.md`).
