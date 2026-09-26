# character-viewer

A dev server over `packages/characters`, for looking at the cast while you work
on it. Nothing is built and nothing is cached — the cast is read off disk on
every request, so a portrait that was just saved is one reload away and the page
is always describing the folder as it actually stands.

```sh
pnpm --filter @claudecafe/character-viewer dev
# or, from the repository root
pnpm dev:viewer
```

It binds `0.0.0.0:5051` and prints the address to open. `PORT` overrides the
port. The cast directory is the sibling `packages/characters`, resolved from
here rather than configured.

## What it shows

**Artwork** — the identity image, and a rail of thumbnails on the left with the
chosen face blown up on the right. The rail is a contact sheet: a grid that grows
columns with the window, and it lists every expression the mood marker can name,
in the order the prompt lists them, so a face the maid does not have is drawn as
a hole and coverage reads without counting.

A picture's width is chosen and its height is never set, so nothing is ever
stretched. The artwork ships at @2, so a 960×1280 portrait is a 480×640 picture
and a 512×1280 one is 256×640. A 36×48 sprite has no useful logical size, so it
gets a width of its own — 360 is ten times its 36 columns, which lands every cell
on a whole square.

`Portraits` and `Pixels` are separate sets; switching between them keeps her on
the same expression. Any arrow key walks the rail — the rail is a grid, so left
and right would otherwise be the one pair of directions that did nothing — and
`[` and `]` change maid. A `variants/<id>/` folder becomes a switch when one
exists.

**Persona** — the persona as read, and `Source` for the file as written, in
whichever languages the folder ships.

**Health** — what a consumer of the cast would trip over, plus a matrix of every
expression against every maid. The findings are the ones that have a
consequence somewhere:

- `art.neutral` — no `portraits/neutral.webp`, so the desktop app does not list
  her and the release shipper refuses the pack.
- `persona.version-mismatch` — the persona files disagree on the version, and
  the release tag is taken from every `persona*.md` in the folder.
- `persona.id` — an `id` that does not match the folder it sits in.
- `art.set-mismatch` — a face drawn as a portrait but not as a pixel sprite, or
  the other way round.
- `art.unknown-expression` — artwork no mood marker can select, because the name
  is not in the table the prompt defines.
- `art.pixel-size` — a sprite that is not 36×48.
- `art.unshippable` — a file in an artwork folder the release globs drop.

Anything that only makes this maid less even than the rest of the cast — a
smaller avatar, a different portrait cut, no `pixels/` at all — is a note rather
than a warning, and is reported as a difference from what the rest of the cast
agrees on.

## Where the vocabulary comes from

The expression names are read from `packages/persona-panel/prompts/cues.md`,
the table the mood marker is told to copy from, so a new expression is
vocabulary the day it lands there and this viewer keeps no list of its own.

It is a read-only viewer. It is not a source of truth for the cast and nothing
in the café reads it.
