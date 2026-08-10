---
description: View or change cafe settings — language, the cast roster, your own personas
argument-hint: [request, e.g. "lang English" / "maid kurumi" / "retire kotone"]
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
- `builtin_cast` — `false` drops the bundled fallback maid (`noname`), so an
  empty personas_dir means nobody on shift instead of her.
- `festivals` — a path to a JSON festival pack replaces the built-in maid-café
  calendar; `false` drops the festival segment. A pack is one flat object of
  fixed dates: `{"02-14": "西洋情人節"}`.
- `look` — `false` stops the background status-line scene generation (one of
  the two features that spend API credit; the other is `diary`).
- `diary` — `false` skips the handover-diary line at session end.
- `greeting` — `false` drops the session-start briefing (greeting, weather,
  diary recap, mood cue); housekeeping still runs.

Individual retirement is per-persona, not in config: `off_duty: true` in a
persona's frontmatter takes her out of the random draw (an explicit pick still
works). The fallback maid retires the same way — a `noname.md` stub in
personas_dir containing only that frontmatter:

```
---
off_duty: true
---
```

Facts you need:

- The draw pool is personas_dir — maids are **hired from claudecafe.dev**
  (download on a maid's page → save into personas_dir; the Chinese versions
  live under claudecafe.dev/zh). If the user wants more maids, that's where
  to send them — or fetch one yourself with
  `curl https://claudecafe.dev/<id>.md` (Chinese: `/zh/<id>.md`) and save it
  as `personas_dir/<id>.md`, with their go-ahead.
- While personas_dir has nobody on duty, the bundled fallback maid `noname`
  (in `${CLAUDE_PLUGIN_ROOT}/maids/`) keeps the café open.
- A persona file: **lowercase filename = id**, YAML frontmatter with `name:`,
  body = the persona instructions.
- This window's shift state: `~/.claude/cafe/sessions/<session_id>/on-shift`
  (read-only here — for showing who's on shift, not for changing it).
- `CLAUDE_MAID` / `CLAUDE_MAID_LANG` env vars override config per run. Config
  changes take effect from the next session start — say so when relevant.

This command does **not** switch the maid mid-session: who's on shift is decided
at session start (`CLAUDE_MAID=kokona claude` for one window, the `maid` config
key for every window). If asked to swap right now, set the config and point at
those instead.

With `$ARGUMENTS`: interpret the request (key-value like "lang English", or
plain language like "only my own maids in the draw" / "retire kotone") and
apply it.

Without arguments: read config.json, personas_dir and the current shift, show a
short status (who's on shift, lang, who's in the draw pool, who's retired),
then use AskUserQuestion to offer: hire a maid from claudecafe.dev / change
the language / retire or rehire a maid (edit her off_duty frontmatter) /
scaffold a new persona in personas_dir.
