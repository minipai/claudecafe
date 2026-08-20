# cafe

Claude Café in **one plugin**: a maid on shift (persona injected at session
start) plus the liveliness layer (greeting, per-turn time, mood marker, a
status-line "look" and a shared handover diary). Three commands —
`/cafe:hire` to hire a maid, `/cafe:config` for settings, `/cafe:statusline`
to wire up the status line; everything else is hooks.

The plugin is the café's operating system; the maids themselves are **hired
from [claudecafe.dev](https://claudecafe.dev)** — `/cafe:hire <id>` fetches a
maid's persona (`claudecafe.dev/<id>.md`, Chinese under `/zh/`) into
`~/.claude/cafe/personas/`, and a maid page's download link is the manual
route to the same folder. Until someone is hired, a nameless maid keeps the
place open.

| Component | Type | What it does |
|-----------|------|--------------|
| `load-persona.py` | `SessionStart` hook | Puts a maid on shift: injects the chosen persona's body (frontmatter stripped) plus the reply language. Shift order: `CLAUDE_MAID` env → this session's `on-shift` file → config `maid` → a draw from the maids you've hired into `personas/`; while nobody is hired, the bundled nameless maid keeps the café open. `none` = nobody on shift (no persona injected — bring your own via `CLAUDE.md`). |
| `session-greeting.py` | `SessionStart` hook | Hands over the local time (no scripted wording — a hardcoded "it is getting late" never expires), the weather (wttr.in, 2s cap, skipped offline), the recent handover-diary entries, and the mood-marker cue. Also starts the shift tidy: resets the shift clock and last shift's look, and sweeps session state older than 7 days. |
| `current-time.py` | `UserPromptSubmit` hook | A per-turn status line for the model: current time ｜ hours on shift ｜ today's commits ｜ festival, so the clock never goes stale. |
| `look-update.py` | `Stop` hook | Has the maid "check the mirror": forks a background `claude -p --model haiku` that writes a scene line + a dialogue line to `look.txt`. The maid's mood is read straight off the transcript (the last `【 mood kaomoji 】` marker). Regenerates after every tool-using turn; chat-only turns re-check every 50k tokens of context growth. Opt-in (`look: true`, set by `/cafe:statusline`) — off, it exits before spending anything. |
| `diary-write.py` | `SessionEnd` hook | The maid on shift leaves one line in the shared handover diary — written by a detached background `claude -p --model haiku` from a transcript digest, so it's in her voice. |
| `link-bin.py` | `SessionStart` hook | Keeps `~/.claude/cafe/bin` symlinked at this version's `bin/`, so status-line config survives version bumps. |

The mood marker is a **response-style flourish** for the reply itself; consumers
(the look generator today, a companion app tomorrow) read it straight off the
transcript. Its kaomoji come from a fixed 26-row table mapping 1:1 to
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
- `builtin_cast` — `false` drops the bundled nameless maid, so an empty
  personas_dir means nobody on shift instead of her.
- `festivals` — the built-in festival calendar is maid-café flavored
  (Valentine's, White Day, Maid Day…). A path to your own JSON pack replaces
  it; `false` drops the festival segment entirely. A pack is one flat object
  of fixed dates: `{"02-14": "西洋情人節", "10-10": "國慶日"}` — movable feasts
  (lunar calendar, nth-weekday rules) are out of scope.
- `look` — `true` turns on the background mirror shots (default off — they
  spend API credit, a `claude -p --model haiku` call each, and are invisible
  until a status line displays them). `/cafe:statusline` sets this up
  end to end; without it the status line shows the maid's bare name.
- `diary` — `false` skips the handover-diary line at session end.
- `greeting` — `false` drops the session-start briefing (greeting, weather,
  diary recap, mood-marker cue). Housekeeping (shift clock, session sweep)
  still runs.

A persona is an `<id>.md` file in personas_dir (frontmatter with `name:`,
body = the persona instructions; **lowercase filename**, that's the id) —
whether hired from claudecafe.dev or written yourself, same format. Everyone
in personas_dir joins the draw pool automatically; the first hire relieves
the nameless maid.

Retirement is per-persona: `off_duty: true` in the frontmatter takes a maid
out of the random draw (an explicit pick still works). The nameless maid can
be retired the same way — a `noname.md` stub containing only that frontmatter.
When every hired maid is off duty, she comes back to keep the café open.

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

`/cafe:statusline` does the whole thing — it detects your setup (native
`statusLine`, ccstatusline, or nothing yet), wires the display in, and flips
`look` on. The manual version, if you'd rather:

The native `statusLine` runs one script that prints both rows
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
Wiring it by hand? Also set `"look": true` in `~/.claude/cafe/config.json` —
generation stays off until someone can see it.

## No build step

Everything the plugin ships is checked in — `maids/` holds only the nameless
fallback maid, and the cast proper lives on claudecafe.dev. Everything is
plain `python3` (hooks run in a non-interactive shell with no node/bun on
PATH).

Before installing or bumping, run the logic tests (sandbox HOME, no network):

```
python3 packages/cafe/test.py
```

## Install

```
/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json
/plugin install cafe@claudecafe
```

Releases are cut with `ship.sh` (bump the version in `.claude-plugin/plugin.json`
first — published zips are immutable). Working on the plugin itself? Point the
marketplace at your checkout instead (`/plugin marketplace add /path/to/claudecafe`)
and skip the shipping round trip.

## Notes

- Praising / 邀功 lives inside each persona file — it's character behaviour,
  not a shared util.
- A persona is mostly tone by example, and the examples are quoted lines — a
  maid told to answer in a language her file isn't written in has to translate
  her own register, which is where a persona goes flat. That's why the site
  offers each maid per language (English at the root, Chinese under `/zh`):
  hire the one already written in the language she'll speak.
