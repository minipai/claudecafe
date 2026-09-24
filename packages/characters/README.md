# characters

The cast. One folder per character, named after her, containing her persona and
the runtime artwork shipped with it:

```
kurumi/
  persona.zh.md        YAML metadata + the Chinese persona body
  persona.en.md        the same character written naturally in English
  avatar.webp          stable square identity image
  portraits/           default visual variant, for graphical clients
    neutral.webp       runtime portrait; filename = expression ID
  pixels/               default 36×48 terminal portraits
    neutral.gif         static or animated; filename = expression ID
  variants/
    one-piece/
      portraits/       a complete visual alternative, still the same maid
```

A folder counts as a character **only if it holds a persona file** — which is why
the drawing scripts can sit beside the five without being mistaken for a sixth.

The character root is a complete default variant: it owns `avatar.webp`,
`portraits/`, and optional `pixels/`. A different outfit is visual artwork for
the same persona, not another character, and lives under `variants/<id>/` with
its own complete runtime artwork. Missing variant artwork does not fall through
to another outfit midway through a conversation.

An independently distributed variant may declare `extends: <namespaced-id>` in
its own persona frontmatter. That inherits identity, not missing artwork: the
variant still ships every asset it promises.

There is deliberately no `standing.webp`. `portraits/` means person-focused
artwork and does not prescribe full-body or half-body composition. Kotone's
current Retina set is 960 × 1280; terminal art belongs only in `pixels/`.

Persona frontmatter uses `format_version`, a namespaced `id`, `name`, `version`,
`author`, and `description`. Site-specific fields such as `quote`, and the
human-readable `outfits` labels, may live beside them. The Markdown body is the
actual persona.

## Who reads this

- **The website** takes the persona files and the normalized site artwork in its
  own asset bundle.
- **The desktop app** installs character folders under
  `$XDG_CONFIG_HOME/claudecafe/characters` at runtime. It uses the root
  `avatar.webp` and default `portraits/`; visual variants are not shown there.
- **The OpenCode terminal panel** discovers 36×48 `*.gif` files by filename,
  decodes static or animated frames, and draws them as ordinary text cells.
- The café plugin ships none of it: maids are hired from the site.

## Persona interaction eval

`eval.mjs` gives every maid the same six situations in isolated model calls: two
substantial successes, an ordinary answer, blocked work, a breakthrough
supplied by the user, and praise from the user. It runs Claude in safe mode with
no tools or repo instructions, then writes raw JSON and a side-by-side Markdown
review under `/tmp/opencode`.

Evaluate the working tree on its own:

```sh
pnpm --filter @claudecafe/characters eval
```

Compare a committed baseline with the working tree, or increase repeat count to
look for stock closings:

```sh
pnpm --filter @claudecafe/characters eval --baseline HEAD --runs 3
```

Use `--language en` for the English personas and `--model` to test another
Claude model. `--maid` and `--scenario` narrow an iterative run; both flags can
be repeated. Review for character fit, naturalness, restraint on ordinary or
unfinished work, technical clarity, and variation between repeated runs. This
is a behavioral eval rather than a snapshot test: exact wording is not stable
and should not become the contract.

## Where the drawings came from

Everything here is runtime-sized WebP or GIF. The workshop — archival PNG
masters, native generations, upscales, pencil references, shared palettes, and
rebuild scripts — lives in
`art-masters/` beside the repository and never in git, because nothing that runs
reads it. `scripts/normalize-website-art.py` works from there and says so plainly
when it isn't present.

The sprites were generated with AI image tools from those references. See
[LICENSE](LICENSE) — the persona files are written text and protected as such;
the artwork comes with a request rather than a threat.
