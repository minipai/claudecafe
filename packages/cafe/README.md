# cafe

Claude Café in **one plugin**: a maid on shift (persona injected at session
start) plus the liveliness layer (greeting, per-turn time, and mood marker).
Nothing in it is host-only: the same hooks and the same `hire`, `config` and
`look` skills run on Claude Code and Codex. Commands are Claude-only, so the
plugin ships none.

The plugin is the café's operating system; the maids themselves are **hired
from [claudecafe.dev](https://claudecafe.dev)** — `/cafe:hire <id>` fetches a
maid's persona (`claudecafe.dev/<id>.md`, Chinese under `/zh/`) into the current
host's `cafe/personas/`, and a maid page's download link is the manual route to
the same folder. Until someone is hired, a nameless maid keeps the place open.

## Claude Code and Codex

Both hosts discover `hooks/hooks.json` by convention — the persona, greeting
and per-turn time hooks, the whole set. Neither manifest declares a `hooks`
path: a manifest path *adds* to the discovered defaults, so naming the same
file there would run every hook twice. Commands use `CLAUDE_PLUGIN_ROOT` in
Claude Code and `PLUGIN_ROOT` in Codex to find the installed scripts.

Both hosts load the same `skills/` (`config`, `hire`, `look`),
and share one data root: `$XDG_CONFIG_HOME/claudecafe`, defaulting to
`~/.config/claudecafe`. `bin/cafehome.py` is the single resolver for that rule.

| Component | Type | What it does |
|-----------|------|--------------|
| `load-persona.py` | `SessionStart` hook | Puts a maid on shift: injects the chosen persona's body (frontmatter stripped) plus the reply language. Shift order: `CLAUDE_MAID` env → this session's `on-shift` file → config `maid` → a draw from the maids you've hired into `personas/`; while nobody is hired, the bundled nameless maid keeps the café open. `none` = nobody on shift (no persona injected — bring your own via `CLAUDE.md`). |
| `session-greeting.py` | `SessionStart` hook | Hands over the local time (no scripted wording — a hardcoded "it is getting late" never expires), the weather (wttr.in, 2s cap, skipped offline), and the mood-marker cue. Also starts the shift tidy: resets the shift clock and sweeps session state older than 7 days. |
| `current-time.py` | `UserPromptSubmit` hook | A per-turn context line for the model: current time ｜ hours on shift ｜ today's commits ｜ festival, so the clock never goes stale. |
| `look` | skill, both hosts | Asks the maid on shift what she looks like right now — one scene drawn from the work at hand, written in her own voice. Prose only; nothing is stored. |

The mood marker is a **response-style flourish** for the reply itself; consumers
(a companion app, say) read it straight off the transcript. Its kaomoji come from a fixed 26-row table mapping 1:1 to
`@claudecafe/characters` expression artwork, so a companion app can resolve the
current face to an image. The cues are persona-agnostic; only the flavour comes
from whoever is on shift.

## Customizing: config.json and your own personas

The `config` skill is the guided way. Underneath it is one optional shared file:
`~/.config/claudecafe/config.json` (or `$XDG_CONFIG_HOME/claudecafe/config.json`
when set). Every key is optional:

```json
{
  "lang": "繁體中文（台灣用語：「螢幕」不寫「熒幕／屏幕」、「程式碼」不寫「代碼」；嚴禁簡體字）",
  "maid": "mymaid",
  "personas_dir": "~/my-maids",
  "builtin_cast": false,
  "commit_authorship": "author"
}
```

- `lang` — the reply language (default: English). Free-form text injected into
  every prompt, so it's not limited to a language name — spell out regional
  usage or wording bans like the example above and the maid obeys them.
  `CLAUDE_MAID_LANG` env overrides per run.
- `maid` — a fixed pick instead of the random draw; `"none"` puts nobody on
  shift (no persona injected). `CLAUDE_MAID` env overrides per window.
- `personas_dir` — where your own persona files live (default
  `<current Cafe root>/personas`).
- `builtin_cast` — `false` drops the bundled nameless maid, so an empty
  personas_dir means nobody on shift instead of her.
- `commit_authorship` — how a Cafe maid is credited in commits: `"co-author"`
  (default) keeps your Git identity and adds the maid's `Co-Authored-By`
  trailer; `"author"` uses `git commit --author` for the maid while you remain
  committer. The loader emits one mode's instruction only, so global commit
  rules cannot leave both forms active.
- `festivals` — the built-in festival calendar is maid-café flavored
  (Valentine's, White Day, Maid Day…). A path to your own JSON pack replaces
  it; `false` drops the festival segment entirely. A pack is one flat object
  of fixed dates: `{"02-14": "西洋情人節", "10-10": "國慶日"}` — movable feasts
  (lunar calendar, nth-weekday rules) are out of scope.
- `greeting` — `false` drops the session-start briefing (greeting, weather,
  mood-marker cue). Housekeeping (shift clock, session sweep) still runs.

A persona is an `<id>.md` file in personas_dir (frontmatter with `name:`,
body = the persona instructions; **lowercase filename**, that's the id) —
whether hired from claudecafe.dev or written yourself, same format. Everyone
in personas_dir joins the draw pool automatically; the first hire relieves
the nameless maid.

Retirement is per-persona: `off_duty: true` in the frontmatter takes a maid
out of the random draw (an explicit pick still works). The nameless maid can
be retired the same way — a `noname.md` stub containing only that frontmatter.
When every hired maid is off duty, she comes back to keep the café open.

## State: one shared root

```
~/.config/claudecafe/       # or $XDG_CONFIG_HOME/claudecafe

The shared root contains:
  config.json               # settings (optional, see above)
  personas/<id>.md          # your own personas (optional)
  sessions/<session_id>/    # per-window state: on-shift…
```

Config, personas, and session state are all shared across hosts.

Per-window shift state is what lets two windows run different maids at once:
the draw is written into the window's shift file, so resuming brings back the
same maid. Use `CLAUDE_MAID=kokona claude` as a one-shot override at launch.

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

Releases are cut with `scripts/ship-plugin.sh cafe` from the repo root (bump the version in `.claude-plugin/plugin.json`
first — published zips are immutable). Working on the plugin itself? Point the
marketplace at your checkout instead (`/plugin marketplace add /path/to/claudecafe`)
and skip the shipping round trip.

## Notes

- Interaction lives inside each persona file — recognition, shared satisfaction,
  playful challenge, and reassurance are different character behaviours, not a
  shared util every maid has to perform.
- A persona is mostly tone by example, and the examples are quoted lines — a
  maid told to answer in a language her file isn't written in has to translate
  her own register, which is where a persona goes flat. That's why the site
  offers each maid per language (English at the root, Chinese under `/zh`):
  hire the one already written in the language she'll speak.
