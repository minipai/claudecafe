# claudecafe (monorepo)

A pnpm monorepo for the AI maid ecosystem. The repo root **is also a plugin
marketplace named `claudecafe`** (`.claude-plugin/marketplace.json`, listing cafe-bell +
cafe). Six packages; everything with an npm package.json is **namespaced under
`@claudecafe/*`** (the private root stays `claudecafe-monorepo`; `packages/cafe` is pure
python — no package.json, not a workspace member):

- **`apps/desktop`** — the maid's window on the desktop (Electron + React + Agent
  SDK). Transparent and frameless: just a standing portrait that changes expression, and
  she *is* the agent (`@anthropic-ai/claude-agent-sdk`, borrowing Claude Code's
  credentials). **ことね and くるみ** are the two the window carries — the shift is handed
  over in a panel that opens when a conversation is started over, which is the only moment
  it can (her persona lives in the session's system prompt).
- **`apps/website`** — the persona showcase (Hono SSR), and also the **hiring channel**:
  the `/<id>.md` route serves the full persona file including frontmatter — download it
  into `~/.claude/cafe/personas/` (the cafe plugin's draw pool), or keep it anywhere and
  `@path`-link it from your own `CLAUDE.md`.
- **`packages/characters`** — the cast, **one folder per maid, named after her**: her
  persona file per language (`persona.zh.md` / `persona.en.md` — frontmatter = site
  metadata, body = the persona instructions), `expressions/<outfit>/*.webp`,
  `portraits/` (`avatar.webp` + `standing.webp`, both for the site) and `reference/`
  (the drawings she was generated from). Nothing loose at her root but who she is.
  **One folder per outfit**, `uniform` being the café clothes she is normally in: a whole
  fresh set of moods rather than a layer to swap, so a second outfit is a folder and
  nothing else. The folder's name is the name shown — which is all an outfit drawn by
  someone else has to go on, since that author does not own the maid's persona file.
  A folder counts as a character only if it holds a persona file, which is why the shared
  drawing spec (`STYLE.md` + `style/`) and the art scripts can sit beside the five. Only `apps/website`
  depends on it (`workspace:*`) — and its `files` allowlist is **persona files only**, so
  `pnpm deploy` leaves 53 MB of artwork out of the web image. The apps copy the images
  they need at build time; the cafe plugin does not ship the cast.
- **`packages/cafe-bell`** — a pub/sub hub (SSE bus) for Claude Code hook events. Also a
  marketplace plugin.
- **`packages/cafe`** — the Claude Code plugin (hooks + three commands: `/cafe:config` for
  settings, `/cafe:hire` to hire from the site, `/cafe:statusline` to wire the look into the
  status line; settings live in `~/.claude/cafe/config.json`:
  lang / maid / personas_dir / builtin_cast / festivals — retire one maid with `off_duty: true`
  in her frontmatter, shadow a bundled one with a same-id stub). Two layers:
  - **Shift assignment**: `load-persona.py` (SessionStart) injects the on-shift persona's
    body. Order: `CLAUDE_MAID` env (one-shot override) → this window's
    `~/.claude/cafe/sessions/<session_id>/on-shift` → a random draw from personas_dir (the
    maids the user hired; the draw is written back to that file so a resume keeps the same
    one). With nobody hired, the bundled nameless maid `noname` keeps the place open
    (`maids/noname.md`, the plugin's only bundled persona, checked in) and steers the user
    toward hiring at claudecafe.dev. `none` = inject nothing (for users who bring their own
    persona in `CLAUDE.md`).
  - **Liveliness** (persona-agnostic): `session-greeting.py` injects a time-aware greeting +
    the mood-marker cue, `current-time.py` (UserPromptSubmit) injects the current time every
    turn, a Stop hook generates the status line's "look" scene in the background, and
    SessionEnd writes a line in the handover diary.
- **`packages/maid-voice-player`** — a voice player subscribed to the cafe-bell SSE bus
  (launchd resident).

## ⚠️ Three landmines in plugin development

- **Hooks run with no JS runtime on PATH**: node is under nvm, bun under `~/.bun`, and a
  hook's non-interactive shell has neither → **hooks may only use the system's own
  bash/python3**. That's why `cafe`'s hooks are self-contained: pure python3 stdlib, no repo
  paths, no symlinks, no node/bun. cafe also has **no build step** — every shipped file is
  checked in (the cast isn't bundled; it's hired from the site).
- **Always bump the version when you change a plugin**: `/plugin update` compares versions
  and won't reinstall an unchanged one. Bump `packages/<p>/.claude-plugin/plugin.json` and the
  matching entry in the root `marketplace.json` together (plus `package.json` where a plugin
  has one), then `/plugin marketplace update claudecafe` → `/plugin update <p>@claudecafe`.
- **Ask the user before touching the live global config (`~/.claude/`).** Both plugins are
  installed + enabled from the marketplace — there are no loose hook mirrors or symlinks, and
  none should be laid down by hand again.

The mood marker is **emit-only**: the `【…】` at the end of a reply is pure style; no Stop hook
or status line reads it.

## Workspace

- pnpm workspace (`pnpm-workspace.yaml` → `apps/*`, `packages/*`).
- **One lockfile**: the root `pnpm-lock.yaml` serves both local development and the Docker
  deploy. The web image is a multi-stage build (`apps/website/Dockerfile`, **context = repo
  root**): stage 1 installs with node+pnpm `--frozen-lockfile`, then
  `pnpm --filter @claudecafe/website --legacy deploy --prod` (which bundles
  `@claudecafe/maid-personas` into `/out/node_modules/`); stage 2 runs the deploy bundle on
  `oven/bun`.
- Common commands: `pnpm install` (root), `pnpm dev:web`,
  `pnpm --filter @claudecafe/website ship` (deploy the site).
- cafe-bell / maid-voice-player have no npm dependencies — run them straight with bun/shell;
  cafe is pure python with no build.

## apps/desktop

Electron (`electron/*.ts`, the main process) + Vite/React 19/Tailwind (`src/`) + Agent SDK.

- **The cast is copied in, not read live**: `scripts/pack-sprites.sh` mirrors
  `packages/characters/<maid>/expressions/<outfit>/` into `src/assets/cast/` as webp, and
  that folder is then the single source of truth — the window globs it for who can be
  picked, and `electron/build.mjs` reads the same folder to decide whose persona ships.
  Adding a maid or an outfit means running that script, nothing else.
- **The main process ignores HMR**: any change under `electron/` (SDK session, tools, look
  watcher, ipc) needs the dev app restarted — `node electron/dev.mjs` (**never pass `--dir=`**, it
  overwrites the folder she remembers). Only `src/` updates live.
- **The dev build and the packaged build coexist with separate state**
  (`~/Library/Application Support/ClaudeCafe` vs `ClaudeCafe (dev)`).
  `release/mac-arm64/ClaudeCafe.app` is the one the user actually uses — leave it alone when
  restarting the dev build.
- **Language split**: the interface is English, but what she says follows the user's language —
  the handful of lines the window feeds her (greeting, interrupted, asking permission, plan) are
  generated once at startup per the café config's `lang` and stored in `lines.json` under
  userData, with English as the built-in fallback (`electron/lines.ts`).
- Releases go through `scripts/ship.sh` (package → zip → R2 `claudecafe-downloads` =
  dl.starcoder.dev, versioned and never overwritten) → bump the version in
  `apps/website/src/pages/AppPage.tsx` by hand → ship the site.
- **What's still missing before handing it to a stranger is tracked in `notes/NOTES.md`**
  (signing/notarization, `@` file completion, the persona existing only in Chinese…).

## apps/website

Hono + JSX (SSR), gray-matter, marked, TypeScript.

- Persona files live in `packages/characters/<id>/persona.<lang>.md`; the site locates the
  package via `require.resolve('@claudecafe/characters/package.json')` (works through the pnpm
  symlink in dev and through the deploy bundle in Docker).
- **i18n**: English at the root, Chinese under `/zh/` (`href()` in `src/i18n.ts` builds the
  URLs; hreflang cross-links, and the switcher's `?lang=` plants a cookie that only redirects
  `/` → `/zh`). English content = translation files: `persona.en.md` beside each maid's
  `persona.zh.md`, blog posts in `apps/website/blog/en/` (same filename), each falling back
  to the Chinese version when missing.
- The maid page's CTA: the whole sentence links to `/<id>.md`, with a download link beside it —
  both include the frontmatter (the cafe plugin's status line reads `name:`). The page itself
  still renders the body only.
- `apps/website/blog/` holds the blog posts (frontmatter: title / date / author); the writing
  style guide is the `CLAUDE.md` in that directory.
