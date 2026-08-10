# cafe

Claude Café in **one plugin**: a maid on shift (persona injected at session
start) plus the liveliness layer (greeting, per-turn time, mood marker, a
status-line "look" and a shared handover diary). One command, `/cafe:config`,
for settings; everything else is hooks.

| Component | Type | What it does |
|-----------|------|--------------|
| `load-persona.py` | `SessionStart` hook | Puts a maid on shift: injects the chosen persona's body (frontmatter stripped) plus the reply language. Shift order: `CLAUDE_MAID` env → this session's `on-shift` file → config `maid` → a draw from the pool (your `personas/` + the bundled cast). `none` = nobody on shift (no persona injected — bring your own via `CLAUDE.md`). |
| `session-greeting.py` | `SessionStart` hook | Hands over the local time (no scripted wording — a hardcoded "it is getting late" never expires), the weather (wttr.in, 2s cap, skipped offline), the recent handover-diary entries, and the mood-marker cue. Also starts the shift tidy: resets the shift clock and last shift's look/mood, and sweeps session state older than 7 days. |
| `current-time.py` | `UserPromptSubmit` hook | A per-turn status line for the model: current time ｜ hours on shift ｜ today's commits ｜ festival, so the clock never goes stale. |
| `look-update.py` | `Stop` hook | Has the maid "check the mirror": forks a background `claude -p --model haiku` that writes a scene line + a dialogue line to `look.txt`. The maid's mood is read straight off the transcript (the last `【 word kaomoji 】` marker). Regenerates after every tool-using turn; chat-only turns re-check every 50k tokens of context growth. |
| `diary-write.py` | `SessionEnd` hook | The maid on shift leaves one line in the shared handover diary — written by a detached background `claude -p --model haiku` from a transcript digest, so it's in her voice. |
| `link-bin.py` | `SessionStart` hook | Keeps `~/.claude/cafe/bin` symlinked at this version's `bin/`, so status-line config survives version bumps. |

The mood marker is a **response-style flourish** for the reply itself; consumers
(the look generator today, a companion app tomorrow) read it straight off the
transcript. Its kaomoji come from a fixed 13-row table mapping 1:1 to
`@claudecafe/maid-assets` expression artwork, so a companion app can resolve the
current face to an image. The cues are persona-agnostic; only the flavour comes
from whoever is on shift.

## Customizing: config.json and your own personas

`/cafe:config` is the guided way (menu or plain language: `/cafe:config lang
English`). Underneath it's one optional file, `~/.claude/cafe/config.json`
(every key optional):

```json
{
  "lang": "繁體中文（台灣用語：「螢幕」不寫「熒幕／屏幕」、「程式碼」不寫「代碼」；嚴禁簡體字）",
  "maid": "mymaid",
  "personas_dir": "~/my-maids",
  "builtin_cast": false
}
```

- `lang` — the reply language (default: English). Free-form text injected into
  every prompt, so it's not limited to a language name — spell out regional
  usage or wording bans like the example above and the maid obeys them.
  `CLAUDE_MAID_LANG` env overrides per run.
- `maid` — a fixed pick instead of the random draw; `"none"` puts nobody on
  shift (no persona injected). `CLAUDE_MAID` env overrides per window.
- `personas_dir` — where your own persona files live (default
  `~/.claude/cafe/personas`).
- `builtin_cast` — `false` removes all bundled maids from the draw pool.
- `festivals` — the built-in festival calendar is maid-café flavored
  (Valentine's, White Day, Maid Day…). A path to your own JSON pack replaces
  it; `false` drops the festival segment entirely. A pack is one flat object
  of fixed dates: `{"02-14": "西洋情人節", "10-10": "國慶日"}` — movable feasts
  (lunar calendar, nth-weekday rules) are out of scope.

Your own personas are `<id>.md` files in personas_dir — same format as the
bundled ones (frontmatter with `name:`, body = the persona instructions;
**lowercase filename**, that's the id). They join the draw pool automatically,
and a file with the same id as a bundled maid replaces her.

Retirement is per-persona: `off_duty: true` in the frontmatter takes a maid
out of the random draw (an explicit pick still works). To retire one bundled
maid, drop a same-id stub containing only that frontmatter into personas_dir.

## State: everything under ~/.claude/cafe/

```
~/.claude/cafe/
  bin → <plugin>/bin        # maintained by link-bin.py
  config.json               # settings (optional, see above)
  diary.md                  # the shared handover diary (trimmed to 200 entries)
  personas/<id>.md          # your own personas (optional)
  sessions/<session_id>/    # per-window state: on-shift, look.txt…
```

Per-window shift state is what lets two windows run different maids at once:
the draw is written into the window's shift file, so resuming brings back the
same maid. Use `CLAUDE_MAID=kokona claude` as a one-shot override at launch.

## Status line

Simplest: the native `statusLine` runs one script that prints both rows
(the scene's subject is the maid's own name; the dialogue rides below):

```json
"statusLine": { "type": "command", "command": "python3 ~/.claude/cafe/bin/statusbar.py" }
```

```
くるみ的指尖在編輯器上輕快跳躍，逐個切換著要改的設定檔
「ご主人様～設定全部整理好了呢～」
```

With [ccstatusline](https://github.com/sirmalloc/ccstatusline), add two **Custom
Command** widgets for the same rows (point at the symlink, never at the versioned
plugin path — that breaks on every update):

```
~/.claude/cafe/bin/statusbar.py 1   # the scene
~/.claude/cafe/bin/statusbar.py 2   # the dialogue
```

Nobody on shift means every widget prints nothing and the rows collapse.

## vendor/ is a build artifact

`vendor/` (gitignored) is generated by `build.py` — a plain copy of the
`packages/maid-personas` cast from this monorepo, no node toolchain anywhere:

```
python3 packages/cafe/build.py
```

⚠️ `/plugin install` only copies files — it does **not** run the build. Build before
installing/updating, or the plugin ships without its cast. Everything is plain
`python3` (hooks run in a non-interactive shell with no node/bun on PATH).

## Install

Part of the `claudecafe` marketplace (this repo's root `.claude-plugin/marketplace.json`).

```
/plugin marketplace add minipai/claudecafe     # or a local path during development
/plugin install cafe@claudecafe
```

## Notes

- Praising / 邀功 lives inside each persona file (`maid-personas/*.md`) — it's character
  behaviour, not a shared util.
