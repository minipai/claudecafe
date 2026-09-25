# Claude Café

A café of AI maids for [Claude Code](https://claude.com/claude-code) and
[OpenCode](https://opencode.ai) — the same assistant, working the room in an apron.

Hire one and she takes the shift: she answers in her own voice, greets you by the
clock, and marks how she feels at the end of every reply. In Claude Code she also
stands in a pixel-art panel beside the conversation. There are five of them, and
they are not interchangeable — ことね coaxes a sulking function back to work,
ここな insists she only helped because she couldn't watch you struggle.

**[claudecafe.dev](https://claudecafe.dev)** — meet them, and hire one.

<p align="center">
  <img src="packages/characters/kanae/avatar.webp" width="96" alt="かなえ">
  <img src="packages/characters/kokona/avatar.webp" width="96" alt="ここな">
  <img src="packages/characters/kotone/avatar.webp" width="96" alt="ことね">
  <img src="packages/characters/kuroko/avatar.webp" width="96" alt="くろこ">
  <img src="packages/characters/kurumi/avatar.webp" width="96" alt="くるみ">
</p>

## Start here

```
/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json
/plugin install cafe@claudecafe
```

Then hire someone:

```
/cafe:hire kotone
```

The shared `hire` skill pulls her persona from the site into the café's shared
pool at `~/.config/claudecafe/personas/`. Hire several and the café assigns one
per session; the shared `config` skill sets the language and picks a regular.
Until anyone is hired, a nameless maid keeps the place open.

The Claude plugin's function module is bundled from the shared character core
at release time; the published archive has no Node, Bun, or Python runtime
dependency. Function hooks are still early access, so enable them when starting
Claude Code with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

## The cast

| | Who she is |
|---|---|
| **かなえ** (Kanae) | Mature, embracing, unhurried — sits with you and untangles it slowly. |
| **ここな** (Kokona) | Confident and sharp-tongued, all bark and secretly soft. |
| **ことね** (Kotone) | Gentle and playful, the classic maid. |
| **くろこ** (Kuroko) | Devoted, possessive, absolutely loyal. |
| **くるみ** (Kurumi) | Soft and clingy, forever asking to be praised. |

Each maid is a folder in [`packages/characters/`](packages/characters): her
persona per language, her expressions, her portraits, and the drawings she was
generated from. A folder counts as a character only if it holds a persona file.

## What's in here

- **[`packages/cafe`](packages/cafe)** — the Claude Code café plugin: a
  JavaScript function profile with persona context, liveliness cues, and the
  pixel portrait panel.
- **[`packages/opencode`](packages/opencode)** — the same café for OpenCode,
  sharing the host-neutral character core: one package, two entrypoints (server
  and TUI).
- **[`apps/desktop`](apps/desktop)** — her window on the desktop
  (Electron + the Claude Agent SDK). Transparent and frameless: a standing
  portrait that changes expression, and she *is* the agent. macOS for now.
- **[`apps/website`](apps/website)** — [claudecafe.dev](https://claudecafe.dev),
  the showcase and the hiring channel (Hono SSR, English and Chinese).
- **[`packages/characters`](packages/characters)** — the cast itself: persona
  files and artwork.

The repository root is itself the plugin marketplace the published shelf is cut
from, which is why a local checkout can stand in for it while you work.

## Development

```bash
pnpm install
pnpm dev:web                              # the site, on :5050
pnpm --filter @claudecafe/desktop dev # the window's renderer
```

Working on the plugin itself? Point the marketplace at your checkout —
`/plugin marketplace add /path/to/claudecafe` — and skip the release round trip.

The desktop app's main process ignores HMR — restart it (`node electron/dev.mjs`
inside `apps/desktop`) after touching anything under `electron/`. `pnpm -r check` runs the types and the tests. The Claude function profile is
checked separately with `scripts/build-cafe-function.sh` followed by
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test packages/cafe`.

## The artwork

The sprites and portraits were **generated with AI image tools**, from our own
pencil references and a written style spec, then normalized by the scripts in
[`packages/characters/scripts/`](packages/characters/scripts). They are nobody
else's drawings.

What git carries is what the apps load: the webp sprites and portraits. The
workshop behind them — the PNG masters, the pencil references, the style spec —
stays on disk beside the repository, because nothing that runs reads it.

## License

The source code is MIT — see [LICENSE](LICENSE).

The maids are not: their persona files and artwork are covered by
[`packages/characters/LICENSE`](packages/characters/LICENSE), which asks you to
use them, change them for yourself, and not publish them as your own.
