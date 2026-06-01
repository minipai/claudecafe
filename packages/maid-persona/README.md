# maid-persona

Puts a maid **on shift**. A `SessionStart` hook injects the chosen persona so
Claude speaks in character for the whole session.

It pairs with — but is separate from — [`maid-vibe`](../maid-vibe), which is the
persona-*agnostic* liveliness layer (greeting, mood, `/look`). `maid-persona` is
the part that picks *who's* on shift; `maid-vibe` animates whoever that is.

## How it works

| Component | Type | What it does |
|-----------|------|--------------|
| `hooks/load-persona.sh` | `SessionStart` hook | Reads the on-shift maid's `*.md` from the plugin's bundled `vendor/` dir, strips the frontmatter, and injects the body as the session persona (plus the response-language directive). |

## Self-contained — vendored cast (build step)

The runtime hook is **pure bash** and reads `${CLAUDE_PLUGIN_ROOT}/vendor/<maid>.md`. Nothing
external is needed: it works straight from the marketplace cache with **no env var, no repo path,
no symlink, and no `node`/`bun`** (hooks run in a non-interactive shell that may not have a JS
runtime on PATH — e.g. an nvm/`~/.bun` install).

`vendor/` is **generated**, not hand-maintained. `build.ts` resolves the `@claudecafe/maids`
package (a `devDependency` — so it's the package, not a `../maids` path) and copies the persona
`*.md` in. It is **git-ignored**; regenerate after editing the cast:

```sh
pnpm --filter @claudecafe/maid-persona build    # bun build.ts -> vendor/
```

> ⚠️ `/plugin install` copies files but does **not** run a build. This repo's marketplace is a
> *directory* source, so the (git-ignored) `vendor/` is copied from the working tree as long as
> you ran `build` before (re)installing. **Build before installing.** (For a git-source
> marketplace you'd instead commit `vendor/`.)

## Config

| Env var | Default | Meaning |
|---------|---------|---------|
| `CLAUDE_MAID` | `kurumi` | Which maid is on shift (matches a `<slug>.md` in the cast). |

## Notes

- Persona is injected **per session** (SessionStart re-fires on resume/compact),
  not held as persistent `CLAUDE.md` text — so swapping `CLAUDE_MAID` takes
  effect on the next session with no file edits.
- Replaces the old `@cafe/<maid>.md` import in `~/.claude/CLAUDE.md`.
