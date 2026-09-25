---
name: hire
description: Hire or update a Cafe maid persona from claudecafe.dev.
---

`CAFE_ROOT` is `$XDG_CONFIG_HOME/claudecafe` when `XDG_CONFIG_HOME` is set,
otherwise `$HOME/.config/claudecafe`. Use that path directly; this Claude plugin
has no command-hook helper scripts.

Read `CAFE_ROOT/config.json`, treating a missing or invalid file as an empty
JSON object. Resolve `personas_dir` from its non-empty `personas_dir` key, or
default to `CAFE_ROOT/personas`. Expand `~` and create the directory if needed.

Download a requested maid's complete persona file from:

- English: `https://claudecafe.dev/<id>.md`
- Traditional Chinese: `https://claudecafe.dev/zh/<id>.md`

Choose the version matching config `lang` or the conversation language. Ask
only when the intended language is genuinely unclear. Save the result as
`personas_dir/<id>.md`, using a lowercase id. Replacing an existing file is a
rehire/update.

Verify the downloaded file begins with `---` YAML frontmatter. A failed fetch
or missing frontmatter means the id is invalid; do not leave a partial file.

Without a maid id, fetch the matching-language roster from
`https://claudecafe.dev/` (English) or `https://claudecafe.dev/zh` (Traditional
Chinese) with `Accept: text/markdown`, then let the user choose.

After a successful hire, explain that the maid joins the draw pool from the
next session.
