---
name: config
description: View or change Cafe settings, language, maid selection, personas, commit authorship, festivals, or the session-start greeting.
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
- `personas_dir` — user's persona `*.md` folder (default:
  `CAFE_ROOT/personas`).
- `builtin_cast` — `false` removes the bundled fallback maid.
- `commit_authorship` — `"co-author"` (default) adds the maid as a
  `Co-Authored-By` trailer while keeping the user's Git identity; `"author"`
  uses the maid's identity with `git commit --author` and keeps the user as
  committer. These modes are mutually exclusive.
- `festivals` — custom JSON festival-pack path; `false` disables festivals.
- `greeting` — `false` disables the session-start briefing.

Individual retirement belongs in a persona's frontmatter as `off_duty: true`,
not in config. A frontmatter-only `noname.md` stub in `personas_dir` retires the
bundled fallback maid from the random draw.

The draw pool includes the flat files in `personas_dir` and any manually
added `characters/<id>/` folders under `CAFE_ROOT`. A persona uses a lowercase
filename or folder id, YAML frontmatter with `name:`, and a body containing
persona instructions. The bundled fallback is under the plugin's `maids/`
directory.

Environment variables `CLAUDE_MAID` and `CLAUDE_MAID_LANG` remain supported as
one-run overrides. Config changes affect the next session; do not claim to
switch the current session's maid.

When asked to show status, read the Cafe's config, personas, and session state.
When asked to change settings, apply only the requested change.
