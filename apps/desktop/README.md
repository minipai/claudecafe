# desktop

The maid's window: a standing portrait on your desktop, transparent and
frameless, that changes expression while she works. She isn't a chat client
talking to an agent — she **is** the agent (`@anthropic-ai/claude-agent-sdk`,
borrowing Claude Code's credentials), so she reads your files, asks before she
touches anything, and reports back in her own voice.

Electron for the window (`electron/`, the main process), Vite + React for what's
inside it (`src/`).

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

## Her artwork

`scripts/pack-sprites.sh` copies the maids named in it out of
`packages/characters` into `src/assets/cast/`, which is then the single source of
truth: the window globs that folder for who can be picked, and the packaging step
reads the same folder to decide whose persona travels inside the app. `pnpm dev`
and `pnpm build` run it for you.

Sprite and persona have to arrive together. A maid the window can stand up but
has no persona for would answer as a plain assistant wearing her face.

## Releasing

`pnpm package` builds the app bundle (`release/`); `scripts/ship.sh` uploads a
versioned zip to the download shelf, which is never overwritten. Then the version
on the site's download page is bumped by hand and the site is shipped.

macOS on Apple silicon for now, ad-hoc signed — no notarization, which is one of
the things standing between this and handing it to a stranger.
