# characters

The cast. One folder per maid, named after her, holding nothing but who she is:

```
kurumi/
  persona.zh.md      frontmatter = the site's metadata, body = who she is
  persona.en.md      the same maid, written again rather than translated
  expressions/
    uniform/         26 sprites, one per mood, named after the mood
      panel.faces    the same 26 moods as terminal pixels, in one file
  portraits/         avatar.webp + standing.webp, for the site
```

A folder counts as a character **only if it holds a persona file** — which is why
the drawing scripts can sit beside the five without being mistaken for a sixth.

**One folder per outfit**, `uniform` being the café clothes she is normally in. An
outfit is a whole fresh set of moods rather than a layer to swap on, so adding one
means adding a folder and nothing else. Everything that outfit is drawn as lives
in it: the webp the apps show, and `panel.faces`, the same moods packed for a
terminal's cells — one file rather than 26, because a panel may be asked for any
mood at any moment and fetching them one by one would stall on the first of each. The folder name is the name shown, which
is all a second artist has to go on — they don't own her persona file.

## Who reads this

- **The website** takes the persona files (the package's `files` allowlist is
  persona files only, so the deploy image stays small).
- **The desktop app** copies the sprites in at build time — `pack-sprites.sh`
  globs `*.webp`, so `panel.faces` stays out of the window's bundle.
- **A terminal panel** (the `cc-maid` mod today) reads `panel.faces`: a palette
  and three index planes per mood, gzipped and base64'd, because a plugin reads
  files as UTF-8 text. `art-masters/kotone/panel/tools/export-faces.py` writes it.
- The café plugin ships none of it: maids are hired from the site.

## Where the drawings came from

Everything here is webp, the size the apps actually load. The workshop —
the PNG masters, each maid's pencil references, the shared style spec — lives in
`art-masters/` beside the repository and never in git, because nothing that runs
reads it. `scripts/normalize-website-art.py` works from there and says so plainly
when it isn't present.

The sprites were generated with AI image tools from those references. See
[LICENSE](LICENSE) — the persona files are written text and protected as such;
the artwork comes with a request rather than a threat.
