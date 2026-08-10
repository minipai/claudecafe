---
description: View or change cafe settings — language, who's on shift, the cast roster, your own personas
argument-hint: [request, e.g. "lang English" / "maid kurumi" / 換ことね上班]
---

The user wants to view or change the cafe plugin's settings. All persistent
settings live in `~/.claude/cafe/config.json` — create it if missing; every key
is optional:

- `lang` — reply language, free-form text — regional usage and wording bans
  work too, e.g. `繁體中文（台灣用語：「螢幕」不寫「熒幕／屏幕」）` (default: English).
  Injected into the persona wrapper and every generated prompt.
- `maid` — fixed maid id for new sessions instead of the random draw;
  `"none"` = nobody on shift (no persona injected).
- `personas_dir` — folder holding the user's own persona `*.md` files
  (default `~/.claude/cafe/personas`).
- `builtin_cast` — `false` removes all bundled maids from the draw pool.
- `festivals` — a path to a JSON festival pack replaces the built-in maid-café
  calendar; `false` drops the festival segment. A pack is one flat object of
  fixed dates: `{"02-14": "西洋情人節"}`.

Individual retirement is per-persona, not in config: `off_duty: true` in a
persona's frontmatter takes her out of the random draw (an explicit pick still
works). To retire a **bundled** maid, write a same-id stub in personas_dir —
the override wins:

```
---
off_duty: true
---
```

Facts you need:

- Bundled ids: the `*.md` filenames in `${CLAUDE_PLUGIN_ROOT}/vendor/` (if that
  variable isn't expanded, use the newest `~/.claude/plugins/cache/*/cafe/*/vendor/`).
- A persona file: **lowercase filename = id**, YAML frontmatter with `name:`,
  body = the persona instructions. Same id as a bundled maid overrides her.
- This window's shift state: `~/.claude/cafe/sessions/<session_id>/on-shift`
  (find the session by the most recently modified dir, or ask the user).
- `CLAUDE_MAID` / `CLAUDE_MAID_LANG` env vars override config per run. Other
  config changes take effect from the next session start — say so when relevant.

With `$ARGUMENTS`: interpret the request (key-value like "lang English", or
plain language like 「換ことね上班」「只排自訂的女僕」) and apply it.

Without arguments: read config.json, personas_dir and the current shift, show a
short status (who's on shift, lang, who's in the draw pool, who's retired),
then use AskUserQuestion to offer: switch the on-shift maid / change the
language / retire or rehire a maid (edit her off_duty frontmatter; for a
bundled maid, create or delete the stub override) / scaffold a new persona in
personas_dir.

When the user switches the maid for **this window**: write the id to this
session's `on-shift` file, then read the new persona (frontmatter stripped) and
adopt it immediately — the old maid clocks out with one line, the new one
greets in her own voice. If they want it for every future session instead,
set `maid` in config.json.
