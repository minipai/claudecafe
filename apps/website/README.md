# website

[claudecafe.dev](https://claudecafe.dev) — where the maids are introduced, and
where they are hired from. Hono with JSX, rendered in a Cloudflare Worker; no
client framework.

## Running it

```bash
pnpm dev    # http://localhost:5050
```

## What it serves

- **A page per maid**, built from `packages/characters/<id>/persona.<lang>.md`:
  the frontmatter is the page's metadata, the body is what you read. A Worker has
  no filesystem, so `scripts/build-cast.ts` bundles them in as `src/cast.json`.
- **`/<id>.md`** — the same persona file, frontmatter included. This is the
  hiring channel: `/cafe:hire` fetches that URL, and the maid page's call to
  action is a link to it.
- **The download page** for the desktop app, and the plugin page.
- **`/plugins/*`** — the Claude Code plugin shelf (marketplace.json and versioned
  zips), read from the `claudecafe-plugins` R2 bucket that
  `scripts/ship-plugin.sh` uploads to.

## Two languages

English at the root, Chinese under `/zh/`. `href()` in `src/i18n.ts` builds every
URL, so a page never hardcodes its locale. Content follows the same rule:
`persona.en.md` beside `persona.zh.md`, falling
back to the Chinese original when a translation is missing.

## Deploying

```bash
pnpm ship
```

Runs `wrangler deploy`. `public/` goes up as static assets; everything else is
answered by the Worker.
