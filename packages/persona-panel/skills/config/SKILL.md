---
name: config
description: View or change Cafe settings, language, maid selection, commit authorship, festivals, or the session-start greeting.
---

`CAFE_ROOT` is `$XDG_CONFIG_HOME/claudecafe` when `XDG_CONFIG_HOME` is set,
otherwise `$HOME/.config/claudecafe`. Use that path directly; this Claude plugin
has no command-hook helper scripts.

All persistent settings live in `CAFE_ROOT/config.json`. Treat a missing or
invalid file as an empty JSON object. When changing it, create `CAFE_ROOT` if
needed, preserve unknown keys, and write valid JSON. Every key is optional:

- `lang` — reply language, including regional wording preferences (default:
  English).
- `maid` — fixed maid id for new sessions; `"none"` means nobody on shift.
- `commit_authorship` — `"co-author"` (default) adds the maid as a
  `Co-Authored-By` trailer while keeping the user's Git identity; `"author"`
  uses the maid's identity with `git commit --author` and keeps the user as
  committer. These modes are mutually exclusive.
- `festivals` — custom JSON festival-pack path; `false` disables festivals.
- `greeting` — `false` disables the session-start briefing.

Individual retirement belongs in a persona's frontmatter as `off_duty: true`,
not in config.

The draw pool includes any `characters/<id>/` folders under `CAFE_ROOT` and the
cast bundled in the plugin's own `characters/` directory; a user folder wins over
a bundled one with the same id. A character uses a lowercase folder id and a
`persona.*.md` with YAML frontmatter holding `name:` and a body containing
persona instructions. The bundled fallback, used when every maid is off duty, is
under the plugin's `maids/` directory.

Environment variables `CLAUDE_MAID` and `CLAUDE_MAID_LANG` remain supported as
one-run overrides. Config changes affect the next session; do not claim to
switch the current session's maid.

When asked to show status, read the Cafe's config, characters, and session state.
When asked to change settings, apply only the requested change.
