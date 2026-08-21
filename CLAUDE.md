# claudecafe (monorepo)

A pnpm monorepo for the AI maid ecosystem. The repo root **is also a plugin marketplace
named `claudecafe`** (`.claude-plugin/marketplace.json`, listing the cafe plugin). Four
packages, everything with an npm package.json namespaced under `@claudecafe/*` (the
private root stays `claudecafe-monorepo`; `packages/cafe` is pure python — no
package.json, not a workspace member).

**Each package has its own README. Read the one you are working in** — this file is only
the things that are expensive to find out the hard way.

- **`apps/desktop`** — her window (Electron main process in `electron/`, Vite/React 19/
  Tailwind in `src/`, Agent SDK). She *is* the agent, not a client talking to one.
- **`apps/website`** — claudecafe.dev (Hono SSR): the showcase, and the hiring channel —
  `/<id>.md` serves a persona file, frontmatter included.
- **`packages/characters`** — the cast. One folder per maid: persona per language,
  `expressions/<outfit>/`, `portraits/`, all webp. **The PNG masters, pencil references
  and drawing spec live in `art-masters/` at the repo root, gitignored** — the art scripts
  read from there and stop with a plain error when it isn't present.
- **`packages/cafe`** — the plugin: puts a maid on shift at session start
  (`load-persona.py`) and keeps her alive through the session (greeting, per-turn time,
  status-line look, handover diary). Settings in `~/.claude/cafe/config.json`.

## ⚠️ Three landmines in plugin development

- **Hooks run with no JS runtime on PATH**: node is under nvm, bun under `~/.bun`, and a
  hook's non-interactive shell has neither → **hooks may only use the system's own
  bash/python3**. That's why `cafe`'s hooks are self-contained: pure python3 stdlib, no repo
  paths, no symlinks, no node/bun. cafe also has **no build step** — every shipped file is
  checked in (the cast isn't bundled; it's hired from the site).
- **Always bump the version when you change a plugin**: `/plugin update` compares versions
  and won't reinstall an unchanged one. Bump `packages/cafe/.claude-plugin/plugin.json` and
  the matching entry in the root `marketplace.json` together, then
  `/plugin marketplace update claudecafe` → `/plugin update cafe@claudecafe`.
- **Ask the user before touching the live global config (`~/.claude/`).** The plugin is
  installed + enabled from the marketplace — there are no loose hook mirrors or symlinks,
  and none should be laid down by hand again.

The mood marker is **emit-only**: the `【…】` at the end of a reply is pure style; no Stop hook
or status line reads it.

## Workspace

- pnpm workspace (`pnpm-workspace.yaml` → `apps/*`, `packages/*`), **one lockfile** at the
  root serving both local development and the Docker deploy.
- The web image is a multi-stage build (`apps/website/Dockerfile`, **context = repo root**):
  stage 1 installs with node+pnpm `--frozen-lockfile` and runs
  `pnpm --filter @claudecafe/website --legacy deploy --prod`; stage 2 runs the bundle on
  `oven/bun`.
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
- **The cast is copied in, not read live**: `scripts/pack-sprites.sh` mirrors
  `packages/characters/<maid>/expressions/<outfit>/` into `src/assets/cast/`, which is then
  the single source of truth — the window globs it for who can be picked, and
  `electron/build.mjs` reads it to decide whose persona ships. `pnpm dev` and `pnpm build`
  run it themselves.
- **Language split**: the interface is English, but what she says follows the user's
  language — the lines the window feeds her are generated once at startup per the café
  config's `lang` into `lines.json` under userData (`electron/lines.ts`).
- Releasing: `scripts/ship.sh` → bump the version in `apps/website/src/pages/AppPage.tsx`
  by hand → ship the site.
- What's still missing before handing it to a stranger is tracked in `notes/`, not in git.

## apps/website

- Persona files are found through `require.resolve('@claudecafe/characters/package.json')`
  — works through the pnpm symlink in dev and through the deploy bundle in Docker.
- **i18n**: English at the root, Chinese under `/zh/`; `href()` in `src/i18n.ts` builds every
  URL. English content is a translation file beside the Chinese one (`persona.en.md`,
  `blog/en/<same-name>.md`), falling back to the Chinese version when missing.
- **Verify a deploy on a maid's page, not the home page.** A content directory the app
  cannot find returns an empty list, and the home page answers 200 all the same.
- The blog lives at `/notes`; its writing style guide is the `CLAUDE.md` in `blog/`.
