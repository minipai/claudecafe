# Claude Café

A café of AI maids for [Claude Code](https://claude.com/claude-code) — the same
assistant, working the room in an apron.

Hire one and she takes the shift: she answers in her own voice, greets you by the
clock, marks how she feels at the end of every reply, and leaves a line in the
handover diary when she clocks off. There are five of them, and they are not
interchangeable — ことね coaxes a sulking function back to work, ここな insists she
only helped because she couldn't watch you struggle.

**[claudecafe.dev](https://claudecafe.dev)** — meet them, and hire one.

<p align="center">
  <img src="packages/characters/kanae/portraits/avatar.webp" width="96" alt="かなえ">
  <img src="packages/characters/kokona/portraits/avatar.webp" width="96" alt="ここな">
  <img src="packages/characters/kotone/portraits/avatar.webp" width="96" alt="ことね">
  <img src="packages/characters/kuroko/portraits/avatar.webp" width="96" alt="くろこ">
  <img src="packages/characters/kurumi/portraits/avatar.webp" width="96" alt="くるみ">
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

`/cafe:hire` pulls her persona from the site into `~/.claude/cafe/personas/`,
which is the pool a shift is drawn from. Hire several and the café assigns one
per session; `/cafe:config` sets the language and picks a regular. Until anyone
is hired, a nameless maid keeps the place open.

Everything the plugin needs is the system's own `bash` and `python3` — no build
step, no runtime, no node on `PATH`.

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

- **[`packages/cafe`](packages/cafe)** — the Claude Code plugin. Puts a maid on
  shift at session start and keeps her alive through the session: a time-aware
  greeting, the current time every turn, an optional status-line "look", and the
  handover diary.
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
inside `apps/desktop`) after touching anything under `electron/`. `pnpm -r
check` runs the types and the tests.

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
