# opencode

Claude Café for [OpenCode](https://opencode.ai): a maid on shift (persona,
greeting, per-turn time, mood marker) **and** her portrait in the sidebar — one
package, two faces.

`mods/opencode-maid` and the OpenCode port of `packages/cafe` used to be separate
spikes. They are now one thing: the same café, with the panel attached.

## One package, two entrypoints

OpenCode V2 resolves `server` and `tui` entrypoints from the same package. This
package exposes both without requiring a second CLI config:

```json
{
  "plugins": ["@claudecafe/opencode"]
}
```

For a checkout, configure the package's absolute path instead; see
[Run it](#run-it).

## Server: the café

Shares the Claude Code / Codex plugin's data root — `$XDG_CONFIG_HOME/claudecafe`,
default `~/.config/claudecafe` — so one `config.json` and one `personas/` pool
serve every host.

| V2 extension | What it does |
|------|--------------|
| `session.context` hook | Puts a maid on shift: persona, mood-marker cue, expression cue, a fresh `now` line, and the first-turn briefing are appended to the system context. Shift order: `OPENCODE_MAID`/`CLAUDE_MAID` env → this session's own shift file → config `maid` → a draw from `personas/`. `none` disables the persona while keeping the liveliness cues. |
| Server event stream | Tracks child and deleted sessions so task subagents do not draw a second maid and stale in-memory shifts are released. |
| Tool transform | Adds `set_expression`; calls persist the expression and publish a typed RPC event to the TUI. |
| Café RPC | Gives a newly mounted TUI the current expression and streams later expression changes. |

`config.json` keys, persona files, and `off_duty` are the same ones
[`packages/cafe`](../cafe) documents. The `hire`, `config`, and `look` skills are
Claude Code / Codex skills; here you hire by downloading a persona from
[claudecafe.dev](https://claudecafe.dev) into `personas/`, and there is no
`look`.

## TUI: the portrait

A fixed 3:4 Kotone portrait in the sidebar footer. It reads the same packed
`panel.faces` raster as cc-maid, takes a reviewed 38×25-cell crop, and draws it
with upper/lower half-block glyphs and 24-bit text colours. These are ordinary
terminal cells — no Kitty or Sixel image is sent — so a remote terminal
multiplexer does not need to replay a multi-megabyte image when its tab returns.
The crop fills the inner width of the 42-column sidebar, which OpenCode shows
automatically above 120 terminal columns (toggle with the `sidebar_toggle`
binding, normally `ctrl+x b`).

Run `/maid` to pick an expression manually, or let the model do it: the server
registers a `set_expression` tool with the same 26-expression enum as cc-maid,
and a system cue tells the model when to use it. V2 RPC carries model-selected
expressions to the TUI and restores the current expression when the panel
mounts. There are no heuristic reactions; the model drives the panel.

Every terminal gets the same raster rendering.

## Run it

From the repository root:

```sh
pnpm install # once, to link the workspace and its dependencies
```

Then add the package root to `~/.config/opencode/opencode.jsonc`:

```json
{
  "plugins": ["/absolute/path/to/claudecafe/packages/opencode"]
}
```

OpenCode watches configured local packages and reloads them when their source
changes.

## Layout

- `server.ts` — the conventional V2 server entrypoint.
- `tui.ts` — the conventional V2 TUI entrypoint.
- `src/server.ts` — registers session context, RPC, and the expression tool.
- `src/cafe.ts` — the port: shared-root paths, `config.json`, the cast pool,
  festival pack, prompts, and shift context.
- `src/tui.tsx` — the TUI implementation and sidebar slot.
- `src/faces.ts` — unpacks the shared terminal raster and turns its crop into
  styled half-block text.
- `src/rpc.ts` — the typed expression method and event shared by both
  entrypoints.
- `src/expressions.ts` — the 26-expression list both halves share, plus the
  tool description and system-prompt cue.
- `test/plugin.test.ts` — sandboxed tests with no network.

`pnpm --filter @claudecafe/opencode check` runs the typecheck and the tests.

The prompts and the nameless fallback maid are read from `../cafe`
(`CAFE_PLUGIN_ROOT` overrides the location), so the kaomoji table and the prose
stay in one place. A packaged distribution would bundle those two folders beside
the plugin.
