---
name: config
description: View or change Cafe settings, language, maid selection, personas, festivals, greeting, diary, or look behavior.
---

Resolve `../../bin/cafehome.py` relative to this `SKILL.md`. Run it and use its
output as `CAFE_ROOT`. Every host shares this one Cafe root.

All persistent settings live in `CAFE_ROOT/config.json`. Treat a missing or
invalid file as an empty JSON object. When changing it, create `CAFE_ROOT` if
needed, preserve unknown keys, and write valid JSON. Every key is optional:

- `lang` — reply language, including regional wording preferences (default:
  English).
- `maid` — fixed maid id for new sessions; `"none"` means nobody on shift.
- `personas_dir` — user's persona `*.md` folder (default:
  `CAFE_ROOT/personas`).
- `builtin_cast` — `false` removes the bundled fallback maid.
- `festivals` — custom JSON festival-pack path; `false` disables festivals.
- `greeting` — `false` disables the session-start briefing.
- `look` — Claude Code only; `true` enables status-line scene generation.
- `diary` — Claude Code only; `false` skips the handover diary.

Individual retirement belongs in a persona's frontmatter as `off_duty: true`,
not in config. A frontmatter-only `noname.md` stub in `personas_dir` retires the
bundled fallback maid from the random draw.

The draw pool is the Cafe's `personas_dir`. A persona uses a lowercase
filename as its id, YAML frontmatter with `name:`, and a body containing persona
instructions. The bundled fallback is under the plugin's `maids/` directory.

Environment variables `CLAUDE_MAID` and `CLAUDE_MAID_LANG` remain supported as
one-run overrides on either host. Config changes affect the next session; do
not claim to switch the current session's maid.

When asked to show status, read the Cafe's config, personas, and session state.
When asked to change settings, apply only the requested change.
