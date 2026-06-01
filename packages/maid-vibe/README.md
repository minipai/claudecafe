# maid-vibe

The **liveliness layer** for Claude Café — the persona-*agnostic* utilities that make
whoever's on shift feel alive. It does **not** pick or ship a persona (that's
[`maid-persona`](../maid-persona), loading from the [`maids`](../maids) cast). It ships the
things that animate them:

| Component | Type | What it does |
|-----------|------|--------------|
| `session-greeting.sh` | `SessionStart` hook | Injects a time-aware greeting cue (morning / noon / late-night…) **and the mood-marker cue** — the instruction to end each reply with a `【 mood 顏文字 】` tag. |
| `look` | command | `/look` — describe your current appearance & state in character. |

The mood marker is purely a **response-style flourish** — the cue tells the model to *emit*
a `【 mood 顏文字 】` tag at the end of each reply. It is not captured or persisted (the old
`mood-update.sh` Stop hook and `~/.claude/mood.txt` status-line display were removed). The
cue is persona-agnostic; only the flavour of the moods comes from whatever persona
`maid-persona` loaded.

## Install

Part of the `claudecafe` marketplace (this repo's root `.claude-plugin/marketplace.json`).

```
/plugin marketplace add minipai/claudecafe     # or a local path during development
/plugin install maid-vibe@claudecafe
```

After install the command is namespaced as `/maid-vibe:look`.

## Notes

- Praising / 邀功 lives inside each persona file (`maids/*.md`) — it's character behaviour,
  not a shared util.
