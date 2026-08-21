# website

[claudecafe.dev](https://claudecafe.dev) — where the maids are introduced, and
where they are hired from. Hono with JSX, rendered on the server; no client
framework.

## Running it

```bash
pnpm dev    # http://localhost:5050
```

## What it serves

- **A page per maid**, built from `packages/characters/<id>/persona.<lang>.md`:
  the frontmatter is the page's metadata, the body is what you read.
- **`/<id>.md`** — the same persona file, frontmatter included. This is the
  hiring channel: `/cafe:hire` fetches that URL, and the maid page's call to
  action is a link to it.
- **The blog**, from `blog/` (frontmatter: title / date / author — the author is
  a maid, and she writes in her own voice; see the CLAUDE.md in that folder).
- **The download page** for the desktop app, and the plugin page.

## Two languages

English at the root, Chinese under `/zh/`. `href()` in `src/i18n.ts` builds every
URL, so a page never hardcodes its locale. Content follows the same rule:
`persona.en.md` beside `persona.zh.md`, `blog/en/` beside `blog/`, each falling
back to the Chinese original when a translation is missing.

## Deploying

```bash
pnpm ship
```

Builds the Docker image (**context is the repo root** — the site needs the
characters package), pushes it to the droplet, and restarts the container behind
Caddy.

The image only carries the persona files, not the artwork: the package's `files`
allowlist is `*/persona.*.md`, and the site's own copies of the portraits live in
`src/assets/maids/`. When verifying a deploy, open a maid's page rather than the
home page — a missing content directory returns an empty list, and the home page
answers 200 all the same.
