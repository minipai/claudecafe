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
  personas/<id>.md                     # simple flat persona files
  sessions/<session_id>/
```

`characters/<id>/` is the canonical pack format. A flat `personas/<id>.md` file
still works and wins over a same-id pack. The bundled `maids/noname.md` keeps
the café open when no character pack is installed.

## Claude function profile

`hooks/hooks.json` is a modules-only profile:

```json
{
  "modules": ["./function/register.generated.js"]
}
```

`register.generated.js` is a checked-in bundle of:

- `hooks/function/register.js` — Claude lifecycle, context, panel, and tool adapter
- `hooks/function/faces.js` / `gif.js` — dependency-free GIF and half-block conversion
- `packages/character-core` — persona parsing, selection, prompt, and expression contracts

Rebuild the bundle from the repository root with:

```sh
scripts/build-cafe-function.sh
```

The function-hook runtime has no Node or DOM and is loaded by Claude itself;
the bundle does not invoke `node`, `bun`, or `python3` at runtime.

## Context and panel

The module owns the behavior previously split across the classic hooks:

- chooses the maid from `CLAUDE_MAID`, the session's `on-shift`, `config.json`, or a draw
- strips frontmatter and injects the persona with the configured reply language
- supplies the first-turn greeting, weather, mood-marker cue, current time, shift age, commit count, and festivals
- registers `mcp__cafe__set_expression` and keeps the selected face per session
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
  "personas_dir": "~/my-maids",
  "builtin_cast": false,
  "commit_authorship": "author",
  "greeting": true
}
```

- `lang` — reply language; Chinese settings prefer `persona.zh.md`
- `maid` — fixed maid; `"none"` disables persona injection
- `personas_dir` — flat persona directory override
- `builtin_cast` — `false` removes the nameless fallback
- `commit_authorship` — `co-author` (default) or `author`
- `greeting` — `false` silences only the briefing, not housekeeping
- `festivals` — built-in calendar, a JSON path, or `false`

## Install and develop

```text
/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json
/plugin install cafe@claudecafe
```

For a checkout, point the marketplace at the repository instead. Function hooks
are early access, so start Claude Code with:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

Run the bundled function tests with:

```sh
scripts/build-cafe-function.sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test packages/cafe
```

The plugin is released with `scripts/ship-plugin.sh cafe`. Published archives
are immutable; bump `packages/cafe/.claude-plugin/plugin.json` and the root
marketplace entry before shipping.
