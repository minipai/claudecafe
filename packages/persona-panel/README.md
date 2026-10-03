# persona-panel

persona-panel gives a Claude Code session a character. Claude takes on the
character's persona and voice, gets a short sense of time at each turn, and
shows the character as the work goes: in an interactive terminal a pixel
portrait in a side panel, in the desktop app's Code tab an avatar beside each
reply and a portrait pane.

Three characters from [claudecafe.dev](https://claudecafe.dev) come bundled:
Kotone, Kurumi and Kokona. You can add your own.

## Requirements

persona-panel is built on Claude Code's function hooks, which are early access.
Start Claude Code with them enabled:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

Without that switch only the two skills load; the persona and the panel don't.
The desktop pictures come from the character's pack, not the plugin; in a
desktop session the plugin installs the published packs itself (see below).

## Install

```text
/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json
/plugin install persona-panel@claudecafe
```

Open a new session. Kotone is on shift unless you choose another character, and whoever starts a session stays for it.

## What you get

- **A persona.** The character's persona file is added to Claude's context
  every turn, so Claude answers in the character's voice.
- **A sense of time.** The first turn gets a short greeting cue with the local
  time and weather; every turn gets the current time, how long the session has
  run, how many commits the project has today, and the day's festival if any.
- **A mood marker.** Replies end with a one-line mood and a kaomoji from a fixed
  table. The kaomoji on a completed reply also selects the portrait's expression.
- **The portrait panel.** A pixel portrait beside the conversation, with the
  project, model, context left, rate-limit left and branch above it.
  Claude changes the face through the `set_expression` tool or the reply's mood marker.
- **On the desktop.** Her avatar beside each reply, wearing the face the reply
  signs off with, and her name, whose ◨ opens a portrait pane: her portrait with
  sakura drifting down. With `thoughts` on, the pane also shows her unsaid,
  sharp-tongued aside on the work in a box over her, and wears the face she
  thinks it with. Tool calls play a short
  cut-in above the prompt, and Claude can play one on purpose with the `cut_in`
  tool. `/portrait` reopens the pane.
- **Two skills.** `/persona-panel:config` views or changes the settings;
  `/persona-panel:look` has the character describe what they look like right
  now.

## Settings

Settings live in `~/.config/claudecafe/config.json` (or under
`$XDG_CONFIG_HOME`). Every key is optional, and `/persona-panel:config` can
change them for you. Changes apply from the next session.

```json
{
  "character": "kotone",
  "lang": "English",
  "commit_authorship": "co-author",
  "greeting": true,
  "festivals": true
}
```

- `character` — always use this character; `"none"` turns the persona off.
  Unset, Kotone (or, if she is off duty, the first character on the roster).
- `lang` — the language Claude should reply in. Unset, Claude chooses.
- `commit_authorship` — when Claude makes a Git commit, `"co-author"` adds the
  character as a `Co-Authored-By` trailer; `"author"` makes the character the
  commit author while you stay the committer.
- `greeting` — `false` drops the first-turn greeting, mood-marker cue and
  weather lookup.
- `festivals` — `false` turns the festival calendar off, or a path to a JSON
  file of `"MM-DD": "name"` entries replaces it.
- `thoughts` — `true` shows her thoughts in the desktop portrait pane, each one
  a short model request. Off unless set; while off, the pane's thought box says
  how to turn it on.

## Making a character

A character is a folder under `~/.config/claudecafe/characters/` named by its
id, lowercase letters, digits and hyphens. Only `persona.md` is required:

```text
characters/<id>/
  persona.md            # who she is: frontmatter, then the persona text
  pixels/*.gif          # optional terminal faces, 36×48
  avatars/*.webp        # optional square faces for the desktop
  portraits-540/*.webp  # optional 540×720 desktop portraits, each under 95 KB
```

**1. Write her persona.** Frontmatter on top, then the persona Claude adopts,
in any language:

```markdown
---
name: Mio
waiting:
  - Hold on
  - Reading it now
---

# Personality

You are Mio, a calm, dry-humoured AI maid. You call the user "Master" …
```

| Field | What it does |
|---|---|
| `name` | Her name, shown under the portrait. Defaults to the folder id. |
| `waiting` | Lines shown on the spinner while a turn runs, one at a time. |
| `id` | `claudecafe/<id>` gives her a commit identity (`<id>@claudecafe.dev`) for `commit_authorship`; any other value gives her none. |
| `version` | Compared with a bundled character of the same id; the higher one is used, and yours wins a tie. |
| `extends` | Builds on another character (see below). |
| `off_duty` | `true` skips her when nobody is chosen and the café falls back to someone else. |

The mood-marker table and the expression tool are added for you; the persona
only has to say who she is.

**2. Put her on shift.** A new folder changes nothing until you choose her: set
`"character": "<id>"` in `config.json`, or ask `/persona-panel:config`, then
open a new session.

**3. Give her faces (optional).** Without `pixels/` she still talks in
character, but the terminal shows no portrait. Each GIF is named after the
expression it shows, `neutral.gif` first, from this set:

```text
neutral happy curious thinking focused confused proud smug excited flirty
smitten wink embarrassed pouty worried annoyed sad surprised angry afraid
skeptical frustrated awkward sorry speechless relieved laughing crying oops
pleading facepalm waving
```

Draw as many as you like; she is only offered the faces she has. The desktop
pictures work the same way, but need both `avatars/` and `portraits-540/`.

### Building on an existing character

To change a character without copying her whole file, make a new folder whose
persona says `extends: <id>`. Each frontmatter field it fills in replaces the
other character's, and so does a body that is not blank; whatever it leaves
blank, and any picture folder it lacks, comes from the character it extends.
`off_duty` is the one field never passed on:

```markdown
---
extends: kokona
waiting:
  - 任せて
---
Reply in Japanese, and call the user ご主人様.
```

Your own folder with a bundled character's id replaces her outright, but a
newer bundled version takes over again after an update; `extends` survives
updates.

## What it reads, runs and sends

- **Reads** `config.json` and `characters/` under `~/.config/claudecafe/`, and
  its own bundled files.
- **Writes** one file per session, `~/.config/claudecafe/sessions/<session id>/character`,
  holding the id of the character on shift for that session; and, in a desktop
  session, the published packs of Kotone, Kurumi and Kokona into
  `~/.config/claudecafe/characters/` when one there is missing or older,
  replacing that folder.
- **Downloads** those packs, in a desktop session and only when needed, from the
  project's GitHub releases, checking each archive's SHA-256 before unpacking it.
- **Runs** two local Git commands in the project: `git log --oneline
  --since=midnight` to count today's commits, and `git branch --show-current`
  for the panel. Their output is used only for those two figures. To install a
  pack it runs `curl`, `unzip`, `mkdir`, `mv` and `rm`, which must be on the path.
- **Sends** one request per session to [wttr.in](https://wttr.in), a third-party
  weather service, for the local weather in the greeting. The request carries
  no data of yours, but wttr.in sees your IP address and uses it to guess your
  location. Set `"greeting": false` to skip it.
- **Asks the model**, only with `"thoughts": true`, for her thoughts in the
  desktop portrait pane: about one short Sonnet request per turn, carrying the
  persona and the last few things said and done in the session, through Claude
  Code's own model access.
- **Adds to Claude's context** the persona, the greeting, the time line, the
  weather line and the mood-marker cue. Like the rest of the conversation, that
  context goes to the model provider Claude Code is using.

persona-panel collects nothing itself: no analytics, no telemetry, no account.
See the [privacy note](PRIVACY.md).

## Source

`hooks/function/register.js` is a readable, unminified bundle of the plugin's
source and the shared character code in
[minipai/claudecafe](https://github.com/minipai/claudecafe), under
`packages/persona-panel` and `packages/character-core`. The build that produces
it is `scripts/build-plugin.sh`.

## License

The code is MIT; the bundled characters are under their own license. See
[LICENSE](LICENSE) and [characters/LICENSE](characters/LICENSE).
