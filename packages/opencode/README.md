# opencode

Claude Café for [OpenCode](https://opencode.ai): a maid on shift (persona,
greeting, per-turn time, mood marker) **and** her portrait in the sidebar — one
package, two faces. Character packs are kept in the shared café data root and
can be extended by dropping another folder into `characters/`.

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

Shares the Claude Code plugin's data root — `$XDG_CONFIG_HOME/claudecafe`,
default `~/.config/claudecafe`. Published OpenCode character packs live in
`characters/<id>/`; the legacy flat `personas/` directory and its
`personas_dir` override remain supported for simple persona-only maids.

On startup, the server checks the pinned Kotone, Kurumi, and Kokona packs. A
missing or older local version is downloaded from its GitHub Release, checked
against its SHA-256, unpacked into a staging directory, and atomically moved
into place. Newer local versions and manually added character folders are left
alone. A failed download is logged but does not stop OpenCode from starting.
The installer uses the system `unzip` command.

| V2 extension | What it does |
|------|--------------|
| `session.context` hook | Puts a maid on shift: persona, mood-marker cue, expression cue, a fresh `now` line, and the first-turn briefing are appended to the system context. Shift order: `OPENCODE_MAID`/`CLAUDE_MAID` env → this session's own shift file → config `maid` → a draw from `characters/` and the legacy `personas/`. `none` disables the persona while keeping the liveliness cues. |
| Server event stream | Tracks child and deleted sessions so task subagents do not draw a second maid and stale in-memory shifts are released. |
| Tool transform | Adds `set_expression`; calls validate and persist a GIF-backed face for the active character and session, then publish it in a typed RPC event to the TUI. |
| Café RPC | Gives a newly mounted TUI the active character and face for a session and streams later changes. State is per session, so every window keeps its own portrait. |

`config.json` keys and `off_duty` are the same ones
[`packages/cafe`](../cafe) documents. A manually added pack uses the standard
character layout:

```text
$XDG_CONFIG_HOME/claudecafe/characters/<id>/
  persona.en.md       # or persona.zh.md / persona.md
  pixels/*.gif        # 36×48 faces; neutral.gif is the fallback
```

OpenCode picks `persona.zh.md` for Chinese language settings and
`persona.en.md` otherwise, with the other language as a fallback. The pack's
frontmatter `name` is shown in the sidebar. `/maid` writes an explicit choice
for the current session, so it takes precedence over the environment for that
session. To add a maid, create another lowercase `<id>/` folder; it joins the
draw without being overwritten. Restart or reload OpenCode after adding a pack
so the sidebar rediscovers its faces.

## TUI: the portrait

A character portrait in the sidebar footer follows the maid selected for that
session. Each face is a 36×48 GIF in the active character's `pixels/` directory;
its filename is the face ID exposed to the model and the `/maid` picker. Static
and animated GIFs share one frame with the nameplate and are drawn as 36×24
upper/lower half-block cells with 24-bit text colours. These are ordinary
terminal cells — no Kitty or Sixel image is sent — so a remote terminal
multiplexer does not need to replay a multi-megabyte image when its tab returns.
The framed crop fills the inner width of the 42-column sidebar, which OpenCode
shows automatically above 120 terminal columns (toggle with the `sidebar_toggle`
binding, normally `ctrl+x b`).

Run `/maid` to choose the maid for the current session, or `/face` to pick a
face manually. The model can still drive faces through `set_expression`: the
server validates the face against the active character's installed `*.gif`
files. V2 RPC carries the character and face to the TUI and restores them when
a session's panel mounts. The current face name appears beside the selected
maid's name.
Each session keeps its own portrait, so two windows do not fight over one
character. A pack without `pixels/` still supplies its persona, but has no
portrait to draw. There are no heuristic reactions; the model drives the panel.

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
- `@claudecafe/character-core` — canonical host-neutral persona, selection,
  prompt, and expression contracts; `src/character-core/` is the generated,
  package-local copy carried by the OpenCode archive.
- `src/server.ts` — registers the published-pack sync, session context, RPC,
  and the expression tool.
- `src/characters.ts` — the shared `characters/` catalog, pinned release
  manifest, version comparison, checksum-verified installer, and local lookup.
- `src/cafe.ts` — the port: shared-root paths, `config.json`, the cast pool,
  festival pack, prompts, and shift context.
- `src/tui.tsx` — the TUI implementation and per-character sidebar slot.
- `src/faces.ts` — decodes and composites GIF frames into styled half-block text.
- `src/rpc.ts` — the typed character/expression method and event shared by both
  entrypoints.
- `src/expressions.ts` — discovers the active character's GIF face names and
  holds the tool description and system-prompt cue.
- `test/plugin.test.ts` and `test/characters.test.ts` — sandboxed tests with no
  network.

`pnpm --filter @claudecafe/opencode check` runs the typecheck and the tests.

The prompts and the nameless fallback maid are read from `../cafe`
(`CAFE_PLUGIN_ROOT` overrides the location), so the kaomoji table and the prose
stay in one place. A packaged distribution would bundle those two folders beside
the plugin.
