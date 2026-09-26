// Persona frontmatter, read the same way `character-core` reads it: scalars plus
// one level of nested keys, which is all a persona declares (`outfits`). The raw
// block is handed back untouched so character-viewer can show what is really on disk.

export function parseFrontmatter(text) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!block) return { ok: false, fields: {}, raw: '' }

  const fields = {}
  let group = null
  for (const line of block[1].split(/\r?\n/)) {
    const pair = /^(\s*)([\w.-]+):[ \t]*(.*)$/.exec(line)
    if (!pair) continue
    const [, indent, key, value] = pair
    if (indent) {
      if (group) group[key] = unquote(value)
      continue
    }
    if (value) {
      fields[key] = unquote(value)
      group = null
    } else {
      group = fields[key] = {}
    }
  }
  return { ok: true, fields, raw: block[1] }
}

/** The persona proper, with the metadata block lifted off. */
export function personaBody(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
}

const unquote = (value) => value.trim().replace(/^(['"])(.*)\1$/, '$2')
