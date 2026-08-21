# characters

The cast. One folder per maid, named after her, holding nothing but who she is:

```
kurumi/
  persona.zh.md      frontmatter = the site's metadata, body = who she is
  persona.en.md      the same maid, written again rather than translated
  expressions/
    uniform/         26 sprites, one per mood, named after the mood
  portraits/         avatar.webp + standing.webp, for the site
```

A folder counts as a character **only if it holds a persona file** — which is why
the drawing scripts can sit beside the five without being mistaken for a sixth.

**One folder per outfit**, `uniform` being the café clothes she is normally in. An
outfit is a whole fresh set of moods rather than a layer to swap on, so adding one
means adding a folder and nothing else. The folder name is the name shown, which
is all a second artist has to go on — they don't own her persona file.

## Who reads this

- **The website** takes the persona files (the package's `files` allowlist is
  persona files only, so the deploy image stays small).
- **The desktop app** copies the sprites in at build time.
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
