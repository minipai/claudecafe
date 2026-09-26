# cafe

Claude Café for Claude Code: one function-hook plugin that puts a maid on
shift, adds the time-aware liveliness layer, and opens her pixel portrait panel.
The Claude function module is bundled from the same host-neutral contracts used
by the OpenCode plugin.

The cast is published at [claudecafe.dev](https://claudecafe.dev). Hosts sync
published character packs into the shared café root automatically; a persona is
kept under:

```text
$XDG_CONFIG_HOME/claudecafe/           # default ~/.config/claudecafe
  config.json
  characters/<id>/persona.*.md          # optional full character folders
  sessions/<session_id>/
```

The built plugin also bundles the cast that has terminal pixels under its own
`characters/<id>/` (personas and GIFs only, copied from `packages/characters`
by `scripts/build-plugin.sh`, under that package's license). A user
pack with the same id wins over the bundled one. The bundled `maids/noname.md`
keeps the café open when every maid is off duty.

## Claude function profile

`hooks/hooks.json` is a modules-only profile:

```json
{
  "modules": ["./function/register.js"]
}
```

A hooks module may import only its own files by relative path, so this folder
does not load as it stands: `scripts/build-plugin.sh` builds the plugin Claude
loads into `dist`, where `hooks/function/register.js` is a bundle of:

- `hooks/function/register.js` — Claude lifecycle, context, panel, and tool adapter
- `hooks/function/faces.js` / `gif.js` — dependency-free GIF and half-block conversion
- `packages/character-core` — persona parsing, selection, prompt, and expression contracts

Build it from the repository root, or keep the bundle rebuilding while
developing with `claude --plugin-dir packages/persona-panel/dist` (a change to the
skills, prompts or cast needs another plain build):

```sh
scripts/build-plugin.sh
scripts/build-plugin.sh --watch
```

`scripts/ship-plugin.sh persona-panel` builds and tests the plugin, then ships it as the
archive and commits it to the `release/persona-panel` branch; the Claude plugin
directory tracks that branch, since it reads a branch as-is and runs no build.

The function-hook runtime has no Node or DOM and is loaded by Claude itself;
the bundle does not invoke `node`, `bun`, or `python3` at runtime.

## Context and panel

The module owns the behavior previously split across the classic hooks:

- chooses the maid from `CLAUDE_MAID`, the session's `on-shift`, `config.json`, or a draw
- strips frontmatter and injects the persona with the configured reply language
- supplies the first-turn greeting, weather, mood-marker cue, current time, shift age, commit count, and festivals
- registers `mcp__persona-panel__set_expression` and keeps the selected face per session
- renders the terminal `cafe` pane from the maid's `characters/<id>/pixels/*.gif`, with her name
- resets the face on `/clear` and refreshes status after turns

The panel is terminal-only and opens for interactive sessions. A character pack
without `pixels/` still supplies its persona, but has no portrait to draw.

## Configuration

`config.json` is shared with the other café surfaces:

```json
{
  "lang": "English",
  "maid": "mymaid",
  "commit_authorship": "author",
  "greeting": true
}
```

- `lang` — reply language; Chinese settings prefer `persona.zh.md`
- `maid` — fixed maid; `"none"` disables persona injection
- `commit_authorship` — `co-author` (default) or `author`
- `greeting` — `false` silences only the briefing, not housekeeping
- `festivals` — built-in calendar, a JSON path, or `false`

## Install and develop

```text
/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json
/plugin install persona-panel@claudecafe
```

For a checkout, build with `scripts/build-plugin.sh` and point the marketplace
at the repository instead; its entry loads `packages/persona-panel/dist`. Function hooks
are early access, so start Claude Code with:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

Run the function tests against the built plugin with:

```sh
scripts/build-plugin.sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test packages/persona-panel/dist
```

The plugin is released with `scripts/ship-plugin.sh persona-panel`. Published archives
are immutable; bump `packages/persona-panel/.claude-plugin/plugin.json` and the root
marketplace entry before shipping.
