---
name: config
description: View or change persona-panel settings, reply language, character selection, commit authorship, festivals, or the ambient time and weather context.
---

`DATA_ROOT` is `$XDG_CONFIG_HOME/claudecafe` when `XDG_CONFIG_HOME` is set,
otherwise `$HOME/.config/claudecafe`. Use that path directly; this Claude plugin
has no command-hook helper scripts.

All persistent settings live in `DATA_ROOT/config.json`. Treat a missing or
invalid file as an empty JSON object. When changing it, create `DATA_ROOT` if
needed, preserve unknown keys, and write valid JSON. Every key is optional:

- `lang` — reply language, including regional wording preferences; optional,
  and when unset Claude chooses its own reply language.
- `character` — fixed character id for new sessions; `"none"` means no persona.
- `commit_authorship` — `"co-author"` (default) adds the character as a
  `Co-Authored-By` trailer while keeping the user's Git identity; `"author"`
  uses the character's identity with `git commit --author` and keeps the user as
  committer. These modes are mutually exclusive.
- `festivals` — custom JSON festival-pack path; `false` disables festivals.
- `ambient_context` — `false` drops the session-start greeting, the weather lookup
  and the per-turn time line; the mood marker stays.
- `thoughts` — `true` shows her thoughts in the desktop portrait pane (a short Sonnet request each); off unless set.

Individual retirement belongs in a persona's frontmatter as `off_duty: true`,
not in config.

The roster includes any `characters/<id>/` folders under `DATA_ROOT` and the
cast bundled in the plugin's own `characters/` directory; a user folder wins over
a bundled one with the same id unless the bundled persona version is newer. A character uses a lowercase folder id and a
`persona.md` with YAML frontmatter holding `name:` and a body containing
persona instructions. A persona with `extends: <id>` builds on that character:
the fields and body it fills in override the parent's, the blank ones and a
missing `pixels/` come from the parent, and `off_duty` is never inherited. The bundled fallback, used when every character is off
duty, is under the plugin's `fallback/` directory.

Config changes affect the next session; do not claim to switch the current
session's character.

When asked to show status, read the config, characters, and session state.
When asked to change settings, apply only the requested change.
