---
name: config
description: View or change persona-panel settings, reply language, persona variant, character selection, commit authorship, festivals, or the session-start greeting.
---

`DATA_ROOT` is `$XDG_CONFIG_HOME/claudecafe` when `XDG_CONFIG_HOME` is set,
otherwise `$HOME/.config/claudecafe`. Use that path directly; this Claude plugin
has no command-hook helper scripts.

All persistent settings live in `DATA_ROOT/config.json`. Treat a missing or
invalid file as an empty JSON object. When changing it, create `DATA_ROOT` if
needed, preserve unknown keys, and write valid JSON. Every key is optional:

- `lang` — reply language, including regional wording preferences; optional,
  and when unset Claude chooses its own reply language.
- `variant` — persona variant code; optional. A variant is any short code a
  character ships (a language such as `zh`, an outfit, a mood): the character's
  `persona.<variant>.md` is used when it exists, otherwise its `persona.md`.
- `character` — fixed character id for new sessions; `"none"` means no persona.
- `commit_authorship` — `"co-author"` (default) adds the character as a
  `Co-Authored-By` trailer while keeping the user's Git identity; `"author"`
  uses the character's identity with `git commit --author` and keeps the user as
  committer. These modes are mutually exclusive.
- `festivals` — custom JSON festival-pack path; `false` disables festivals.
- `greeting` — `false` disables the session-start briefing.

Individual retirement belongs in a persona's frontmatter as `off_duty: true`,
not in config.

The draw pool includes any `characters/<id>/` folders under `DATA_ROOT` and the
cast bundled in the plugin's own `characters/` directory; a user folder wins over
a bundled one with the same id. A character uses a lowercase folder id and a
`persona.md` (plus optional `persona.<variant>.md`) with YAML frontmatter holding `name:` and a body containing
persona instructions. The bundled fallback, used when every character is off
duty, is under the plugin's `fallback/` directory.

Config changes affect the next session; do not claim to switch the current
session's character.

When asked to show status, read the config, characters, and session state.
When asked to change settings, apply only the requested change.
