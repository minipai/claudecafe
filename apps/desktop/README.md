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
