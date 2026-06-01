# maid-persona

Puts a maid **on shift**. A `SessionStart` hook injects the chosen persona so
Claude speaks in character for the whole session.

It pairs with — but is separate from — [`maid-vibe`](../maid-vibe), which is the
persona-*agnostic* liveliness layer (greeting, mood, `/look`). `maid-persona` is
the part that picks *who's* on shift; `maid-vibe` animates whoever that is.

## How it works

| Component | Type | What it does |
|-----------|------|--------------|
| `hooks/load-persona.sh` | `SessionStart` hook | Reads the on-shift maid's `*.md` from the `maids` package, strips the frontmatter, and injects the body as the session persona (plus the response-language directive). |

The cast itself lives in the [`maids`](../maids) package (the same persona files
the website serves via "copy source"). This plugin only *loads* one of them — it
ships no personas of its own.

## Config

| Env var | Default | Meaning |
|---------|---------|---------|
| `CLAUDE_MAID` | `kurumi` | Which maid is on shift (matches a `<slug>.md` in the cast). |
| `CLAUDE_MAIDS_DIR` | sibling `maids` package | Where the persona `*.md` live. |

## Notes

- Persona is injected **per session** (SessionStart re-fires on resume/compact),
  not held as persistent `CLAUDE.md` text — so swapping `CLAUDE_MAID` takes
  effect on the next session with no file edits.
- Replaces the old `@cafe/<maid>.md` import in `~/.claude/CLAUDE.md`.
