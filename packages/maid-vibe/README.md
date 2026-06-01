# maid-vibe

The **liveliness layer** for Claude Café — the persona-*agnostic* utilities that make
whoever's on shift feel alive. It does **not** pick or ship a persona (that's
[`maid-persona`](../maid-persona), loading from the [`maids`](../maids) cast). It ships the
things that animate them:

| Component | Type | What it does |
|-----------|------|--------------|
| `session-greeting.sh` | `SessionStart` hook | Injects a time-aware greeting cue (morning / noon / late-night…) **and the mood-marker protocol** — the instruction to end each reply with a `【 mood 顏文字 】` tag. |
| `mood-update.sh` | `Stop` hook | Parses that `【 mood 顏文字 】` tag from the last line and writes `~/.claude/mood.txt`. |
| `look` | command | `/look` — describe your current appearance & state in character. |

The mood marker is a **closed loop inside this plugin**: `session-greeting.sh` tells the
model to *emit* the tag, `mood-update.sh` *captures* it. The protocol is persona-agnostic;
only the flavour of the moods comes from whatever persona `maid-persona` loaded.

## Install

Part of the `claudecafe` marketplace (this repo's root `.claude-plugin/marketplace.json`).

```
/plugin marketplace add minipai/claudecafe     # or a local path during development
/plugin install maid-vibe@claudecafe
```

After install the command is namespaced as `/maid-vibe:look`.

## Notes

- The status line that *displays* `mood.txt` stays as machine-level config
  (`~/.claude/statusline.sh`).
- Praising / 邀功 lives inside each persona file (`maids/*.md`) — it's character behaviour,
  not a shared util.
