---
description: Hire a maid from claudecafe.dev into the draw pool
argument-hint: [maid id, e.g. "kurumi"; empty = browse the roster]
---

The user wants to hire a maid: download her persona file from claudecafe.dev
into personas_dir, so she joins the random draw from the next session start.

Facts you need:

- personas_dir: the `personas_dir` key in `~/.claude/cafe/config.json`,
  default `~/.claude/cafe/personas` — create the folder if missing.
- The site serves each maid's complete persona file (frontmatter included) at
  `https://claudecafe.dev/<id>.md`; the Traditional Chinese version lives at
  `https://claudecafe.dev/zh/<id>.md`. Same id, same girl — a persona reads
  best in the language it was written in, so pick the URL matching the
  language she'll speak (config `lang` / the conversation's language; ask if
  genuinely unclear).
- Save as `personas_dir/<id>.md` — lowercase filename = her id. Saving over
  an existing file is a rehire/update, which is fine.

With `$ARGUMENTS` (an id or a name you can map to one): fetch it —

```
curl -sf https://claudecafe.dev/zh/<id>.md -o <personas_dir>/<id>.md
```

(root URL for English), then check the file starts with `---` frontmatter.
A failed fetch or missing frontmatter means the id doesn't exist — remove the
file, say so, and show the roster instead.

Without arguments: fetch the roster and let the user pick —

```
curl -sf -H "Accept: text/markdown" https://claudecafe.dev/zh
```

(`https://claudecafe.dev/` for English) returns every maid with a one-line
intro. Then hire as above.

After a successful hire, tell the user: she joins the draw from the next
session start — the nameless maid steps aside. To put her on shift right
away, open a new window with `CLAUDE_MAID=<id> claude`.
