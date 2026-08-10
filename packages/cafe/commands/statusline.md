---
description: Wire the maid's "look" into your status line (and turn the look generation on)
---

The user wants the maid's live "look" — a scene line plus a dialogue line,
regenerated in the background after each piece of work — shown in their status
line. Two things have to happen: the display wired up, and `"look": true` set
in `~/.claude/cafe/config.json` (generation is off until someone can see it;
it spends API credit — one `claude -p --model haiku` call per shot).

The renderer is `~/.claude/cafe/bin/statusbar.py` (a symlink the plugin
maintains — always point at it, never at a versioned plugin path):

- `python3 ~/.claude/cafe/bin/statusbar.py` — both rows
- `python3 ~/.claude/cafe/bin/statusbar.py 1` — the scene only
- `python3 ~/.claude/cafe/bin/statusbar.py 2` — the dialogue only

Detect what the user already has, then pick the path:

1. **Read `~/.claude/settings.json`** (may not exist).
2. **No `statusLine` key** → the native one-liner is the whole setup:
   ```json
   "statusLine": { "type": "command", "command": "python3 ~/.claude/cafe/bin/statusbar.py" }
   ```
3. **`statusLine` already points at ccstatusline** (command mentions
   `ccstatusline`) → don't replace it; add two Custom Command widgets to the
   ccstatusline config (`~/.config/ccstatusline/settings.json`) running
   `statusbar.py 1` and `statusbar.py 2` as separate lines. If the config
   format looks unfamiliar, show the user the two commands and let them add
   the widgets via ccstatusline's own TUI instead of guessing.
4. **Some other custom `statusLine` command** → don't overwrite it silently.
   Show what's there and ask: replace it with `statusbar.py`, or leave it and
   just hand over the two row commands to integrate themselves.

Editing `~/.claude/settings.json` or the ccstatusline config is a change to
live global config — show the exact edit and get a clear go-ahead first.

After wiring the display, set `"look": true` in `~/.claude/cafe/config.json`
(create the file if missing, merge with existing keys). Mention that the first
scene appears after the next worked turn — until then the status line shows
the maid's bare name — and that `"look": false` (or removing the key) turns
the spend off again.
