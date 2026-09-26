# persona-panel

A Claude Code function-hook plugin that gives a session a character persona,
adds a time-aware liveliness layer, and opens the character's pixel portrait
panel. The hooks module is bundled from the same host-neutral contracts used by
the OpenCode plugin.

Characters are folders under the shared data root, which the OpenCode and
desktop hosts use too; the published cast is at
[claudecafe.dev](https://claudecafe.dev):

```text
$XDG_CONFIG_HOME/claudecafe/           # default ~/.config/claudecafe
  config.json
  characters/<id>/persona.md            # optional character folders, plus persona.<variant>.md
  sessions/<session_id>/
```

The built plugin also bundles the cast that has terminal pixels under its own
`characters/<id>/` (personas and GIFs only, copied from `packages/characters`
by `scripts/build-plugin.sh`, under that package's license). A user
pack with the same id wins over the bundled one. The bundled
`fallback/noname.md` steps in when every character is off duty.

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

- chooses the character from `config.json`, the session's earlier draw, or a new draw
- strips frontmatter and injects the persona, plus the reply language when one is set
- supplies the first-turn greeting, weather, mood-marker cue, current time, session age, commit count, and festivals
- registers `mcp__persona-panel__set_expression` and keeps the selected face per session
- renders the terminal portrait pane from the character's `characters/<id>/pixels/*.gif`, with the character's name
- resets the face on `/clear` and refreshes status after turns

The panel is terminal-only and opens for interactive sessions. A character pack
without `pixels/` still supplies its persona, but has no portrait to draw.

## Configuration

`config.json` in the data root:

```json
{
  "lang": "English",
  "variant": "zh",
  "character": "kotone",
  "commit_authorship": "author",
  "greeting": true
}
```

- `lang` — reply language, optional; unset leaves the language to Claude
- `variant` — persona variant code, optional: `persona.<variant>.md` over `persona.md`.
  A variant is any short code a character ships: a language, an outfit, a mood
- `character` — fixed character id; `"none"` disables persona injection
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
