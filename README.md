# Claude Café

A café of AI maids for [Claude Code](https://claude.com/claude-code) and
[OpenCode](https://opencode.ai) — the same assistant, working the room in an apron.

The Claude Code plugin bundles its cast; OpenCode syncs published character packs
into the shared café library, and the desktop installs missing packs there.
Once a maid is on shift, she answers in her own voice, greets you by the clock,
and marks how she feels at the end of every reply. In Claude Code she also
stands in a pixel-art panel beside the conversation. Three maids are actively maintained, and
they are not interchangeable — ことね coaxes a sulking function back to work,
ここな insists she only helped because she couldn't watch you struggle.

**[claudecafe.dev](https://claudecafe.dev)** — meet the cast.

<p align="center">
  <img src="packages/characters/kokona/avatar.webp" width="96" alt="ここな">
  <img src="packages/characters/kotone/avatar.webp" width="96" alt="ことね">
  <img src="packages/characters/kurumi/avatar.webp" width="96" alt="くるみ">
</p>

## Start here

```
/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json
/plugin install persona-panel@claudecafe
```

The Claude Code plugin checks your character folders under
`$XDG_CONFIG_HOME/claudecafe/characters/` (default
`~/.config/claudecafe/characters/`) beside its bundled cast, and takes whichever
copy of a maid has the newer persona version (yours on a tie). The café assigns
one available maid per session; the `config` skill sets the language and picks
a regular. A nameless maid is the fallback when no character is available.

For OpenCode installation, see [`packages/opencode`](packages/opencode).
For the macOS desktop app, see [the download page](https://claudecafe.dev/app).

The Claude plugin's function module is bundled from the shared character core
at release time; the published archive has no Node, Bun, or Python runtime
dependency. Function hooks are still early access, so enable them when starting
Claude Code with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

## The cast

| | Who she is |
|---|---|
| **ここな** (Kokona) | Confident and sharp-tongued, all bark and secretly soft. |
| **ことね** (Kotone) | Gentle and playful, the classic maid. |
| **くるみ** (Kurumi) | Soft and clingy, forever asking to be praised. |

These are the maintained cast. Kanae and Kuroko's existing folders remain in the
repository, but are no longer actively maintained.

Each maid is a folder in [`packages/characters/`](packages/characters): her
persona per language, avatar, portraits, and optional terminal pixel art.
A folder counts as a character only if it holds a persona file. Source artwork
lives separately in the gitignored `art-masters/` directory at the repository root.

## What's in here

- **[`packages/persona-panel`](packages/persona-panel)** — the Claude Code café plugin: a
  JavaScript function profile with persona context, liveliness cues, and the
  pixel portrait panel.
- **[`packages/opencode`](packages/opencode)** — the same café for OpenCode,
  sharing the host-neutral character core: one package, two entrypoints (server
  and TUI).
- **[`apps/desktop`](apps/desktop)** — her window on the desktop
  (Electron + the Claude Agent SDK). Transparent and frameless: a standing
  portrait that changes expression, and she *is* the agent. macOS for now.
- **[`apps/website`](apps/website)** — [claudecafe.dev](https://claudecafe.dev),
  the character catalog and plugin showcase (Hono SSR, English and Chinese).
- **[`packages/characters`](packages/characters)** — the cast itself: persona
  files and artwork.
- **[`packages/character-core`](packages/character-core)** — shared persona,
  context, and expression contracts for the three hosts.
- **[`packages/character-viewer`](packages/character-viewer)** — a local artwork
  and persona viewer for development.

The repository root is itself the plugin marketplace the published shelf is cut
from, which is why a local checkout can stand in for it while you work.

## Development

```bash
pnpm install
pnpm dev:web                              # the site, on :5050
pnpm --filter @claudecafe/desktop app      # the Electron app with its dev renderer
pnpm dev:viewer                          # the character viewer, on :5051
```

Working on the plugin itself? Build it with `scripts/build-plugin.sh`, then point
the marketplace at your checkout —
`/plugin marketplace add /path/to/claudecafe` — and skip the release round trip.

The desktop app's main process ignores HMR — restart it (`node electron/dev.mjs`
inside `apps/desktop`) after touching anything under `electron/`. `pnpm -r check` runs the types and the tests. The Claude function profile is
checked separately with `scripts/build-plugin.sh` followed by
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test packages/persona-panel/dist`.

## The artwork

The sprites and portraits were **generated with AI image tools**, from our own
pencil references and a written style spec, then normalized by the scripts in
[`packages/characters/scripts/`](packages/characters/scripts). They are nobody
else's drawings.

What git carries is what the apps load: WebP portraits and avatars, and GIF
terminal sprites. The
workshop behind them — the PNG masters, the pencil references, the style spec —
stays in the gitignored `art-masters/` directory at the repository root. Art
generation scripts read it; the apps do not need it at runtime.

## License

The source code is MIT — see [LICENSE](LICENSE).

The maids are not: their persona files and artwork are covered by
[`packages/characters/LICENSE`](packages/characters/LICENSE), which asks you to
use them, change them for yourself, and not publish them as your own.
