# desktop

The maid's window: a standing portrait on your desktop, transparent and
frameless, that changes expression while she works. She isn't a chat client
talking to an agent — she **is** the agent (`@anthropic-ai/claude-agent-sdk`,
borrowing Claude Code's credentials), so she reads your files, asks before she
touches anything, and reports back in her own voice.

Electron for the window (`electron/`, the main process), Vite + React for what's
inside it (`src/`).

The character stands directly on the transparent desktop with a smooth white
paper border and shadow. Brief reactions mark prompts, completed replies,
questions and errors; reduced-motion preferences disable these animations.

The dialogue and inset composer use OpenChan's maroon-and-cream design. The
name opens the maid picker; the adjoining model/effort control opens a separate
selection window. A permission-mode pill beside Send/Stop cycles through manual,
accept-edits, plan and auto modes when clicked.
Log, Compact
and New sit above the composer, and the project path opens projects. Settings
remain available with ⌘,. There is no ⌘⇧P palette; slash-command completion
and the scene's floating information bubbles remain.

Window shortcuts work from the scene and every side window: ⌘⇧0 returns to the
maid, ⌘L opens history, ⌘⇧L her answer, ⌘⇧O projects, ⌘⇧M models, ⌘⇧U usage,
and ⌘, settings. Each shortcut brings the existing window forward.

Mood markers stay in the reply text. They can still select her expression, but
are not pulled into a separate caption beside the page controls.

Complete dialogue text appears immediately; it is never replayed with a typing
animation. Live replies appear as the Agent SDK streams their text. Each text
block is a dialogue page: the current page updates immediately, while later
pages collect all text received so far until you advance to them. Auto page turns
still wait at reading speed after a page is complete.

Non-English opening and permission lines are generated per maid and spoken
language and cached in a versioned `lines.json` under userData. Bump the cache version in
`electron/characters/lines.ts` when the writing brief changes. Older versions are
treated as missing and replaced after successful generation; English stands in
while generation is unavailable. Opening lines welcome the user without teaching
UI controls or shortcuts that can become stale.

The desktop disables only `persona-panel@claudecafe` through per-session SDK
settings, leaving other user and project plugins and hooks enabled. It owns
the selected character and portrait, and calls `@claudecafe/character-core`'s
shared context function from `UserPromptSubmit` for greeting, mood-marker,
time, session age, commit count and festival cues. Greeting and mood text come
from persona-panel's prompt files; the build copies those files, not a stripped
plugin. The shared `greeting` and `festivals` settings apply here too, including
the first-turn weather lookup when greeting is enabled.

## Running it

```bash
pnpm dev    # the renderer, with hot reload
pnpm app    # the window itself (node electron/dev.mjs)
```

**The main process ignores hot reload.** Anything under `electron/` — the SDK
session, the tools, the ipc — needs the window restarted before it counts. Only
`src/` updates live.

The dev build and a packaged build keep separate state (`ClaudeCafe (dev)`
versus `ClaudeCafe` under Application Support), so you can run one while using
the other.

## Code layout

Keep implementation and its tests together, grouped by responsibility. Aim for
no more than seven files directly inside each source or test directory.

- `electron/` — app entry points, windows, IPC and dev/build launchers.
  `session/` owns the SDK connection and event translation, `history/` owns
  persisted conversations and status, and `characters/` owns the cast and lines.
- `src/galgame/` — the main scene, with dialogue, input, character and panel
  components grouped beneath it.
- `src/agent/` — renderer contracts; `transport/` connects to Electron and
  `demo/` supplies the browser preview.
- `src/windows/` — side-window entry points, with `conversation/`, `settings/`,
  `projects/` and `models/` holding their views and tests.
- `e2e/` — shared Electron fixtures, plus `session/`, `dialogue/` and `actions/`
  scenarios.
- `config/` — Vite, Vitest, Playwright and packaging configuration. Use the
  package scripts so each tool loads its config from this directory.

Checks: `pnpm check`, `pnpm build`, and `pnpm test:e2e`. To limit Vitest workers,
use `pnpm test --maxWorkers=2`.

## Her artwork

The app discovers maids at runtime from `$XDG_CONFIG_HOME/claudecafe/characters`
(default `~/.config/claudecafe/characters`). Keep that folder beside the café
settings; the app does not offer a separate folder chooser or bundle a fixed cast.
On first launch it downloads the Kotone, Kurumi, and Kokona character zips from
the website's GitHub release shelf, checks their SHA-256 hashes, and unpacks
them into `characters/`. Existing character files are left alone. If any
download fails, the others still install; the app opens and shows the error,
then retries the missing one when reopened.

Each maid subfolder contains a `persona.md` (optionally a `persona.zh.md`) and
`portraits/neutral.webp`. An optional `avatar.webp` supplies the picker thumbnail.
Other `portraits/<expression>.webp` files supply expressions; missing expressions
use neutral. The persona and artwork come from
the same folder. Only the default portraits are used; there is no outfit picker.

With no valid maids in that folder, the app shows its expected location. Reopen
the maid picker to refresh the list after adding or removing a maid.

## Releasing

`pnpm package` builds the app bundle (`release/`); `scripts/ship.sh` uploads a
versioned zip to the download shelf, which is never overwritten. Then the version
on the site's download page is bumped by hand and the site is shipped.

macOS on Apple silicon for now, ad-hoc signed — no notarization, which is one of
the things standing between this and handing it to a stranger.
