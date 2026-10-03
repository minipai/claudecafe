# persona-panel — development

What the plugin does and how it is configured is in [README.md](README.md), the
file that ships with it. This file is for working on it in this repository.

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
  characters/<id>/persona.md            # optional character folders; extends: <id> builds on another
  sessions/<session_id>/
```

The built plugin also bundles the cast that has terminal pixels under its own
`characters/<id>/` (personas and GIFs only, copied from `packages/characters`
by `scripts/build-plugin.sh`, under that package's license). A user
pack with the same id wins over the bundled one unless the bundled persona
version is newer, so a pack left behind by an older install cannot hide the
faces a plugin update brings. The bundled
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
archive and commits it to the `release/persona-panel` branch under a
`persona-panel/` folder; the Claude plugin
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
- on the desktop, draws her avatar beside replies, the portrait pane with her Sonnet-written thought, and the
  cut-ins above the prompt (`hooks/function/desktop.js` holds the drawings)

The pixel panel opens for interactive terminal sessions; a pack without `pixels/` still supplies its persona,
but has no portrait to draw. The desktop draws from the pack's `avatars/` and `portraits-540/`, which the
plugin does not bundle: a desktop session installs the published packs (pinned in
`packages/character-core/src/packs.ts`) when the ones in the data root are missing or older. The hooks runtime
fetches and writes text only, so `curl` and `unzip` carry the archive and the module checks its SHA-256.

What the desktop allows was found by trial, not documentation: it draws no `Image`, so every picture is an
`Svg` with the WebP inline (about 98 KB at most); an `Svg` whose `alt` is blank is not drawn; `session.start`
names no surface there; a positioned `Box` does not stretch and paints over unpositioned siblings; the engine's
own nodes refuse to sit under a positioned `Box`; offsets are whole rows, never negative; only `Button`s and
`Markdown` links take a press.

## Develop

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
