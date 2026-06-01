# expressions

The **liveliness layer** for Claude Cafe — the persona-agnostic utilities that make any
of the cafe cast feel alive, regardless of who's on shift.

It does **not** ship the personas themselves (those live in `~/.claude/cafe/` and are wired
through `CLAUDE.md`). It ships the things that animate them:

| Component | Type | What it does |
|-----------|------|--------------|
| `session-greeting.sh` | `SessionStart` hook | Injects a time-aware greeting cue (morning / noon / late-night…) |
| `mood-update.sh` | `Stop` hook | Parses the `【 mood 顏文字 】` tag from the last line and writes `~/.claude/mood.txt` |
| `look` | command | `/look` — describe your current appearance & state in character |

## Install

This repo is itself a marketplace named `claudecafe`.

```
/plugin marketplace add minipai/expressions     # or a local path during development
/plugin install expressions@claudecafe
```

After install the command is namespaced as `/expressions:look`.

## Notes

- The mood tag is rendered by the persona (see each `cafe/*.md`); this plugin only
  captures and persists it. The status line that *displays* `mood.txt` stays as
  machine-level config (`~/.claude/statusline.sh`).
- Praising / 邀功 lives inside each persona file — it's character behavior, not a shared util.
