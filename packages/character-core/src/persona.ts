export type ParsedPersona = {
  id: string
  name: string
  version: string
  offDuty: boolean
  /** The character id this persona builds on, or "" when it stands alone. */
  extends: string
  /** What she says on a spinner while she is off working, turned over one at a time. */
  waiting: string[]
  body: string
}

export function parsePersona(text: string): ParsedPersona {
  const head = frontmatter(text)
  return {
    id: field(head, "id"),
    name: field(head, "name"),
    version: field(head, "version"),
    offDuty: /^off_duty:\s*(?:true|yes)\b/im.test(head),
    extends: /^[a-z0-9][a-z0-9-]*$/.test(field(head, "extends")) ? field(head, "extends") : "",
    waiting: items(head, "waiting"),
    body: personaBody(text),
  }
}

/**
 * A persona built on its parent's: each frontmatter field the child fills in
 * overrides the parent's, and so does a body that is not blank. Whatever the
 * child leaves blank comes from the parent, except `off_duty`: retiring a
 * parent leaves the characters built on it in the draw.
 */
export function extendPersona(child: string, parent: string): string {
  const fields = new Map(entries(frontmatter(parent)))
  fields.delete("off_duty")
  for (const [key, entry] of entries(frontmatter(child))) {
    if (entry.slice(key.length + 1).trim()) fields.set(key, entry)
  }
  fields.delete("extends")
  const body = personaBody(child).trim() ? personaBody(child) : personaBody(parent)
  return `---\n${[...fields.values()].join("\n")}\n---\n${body}`
}

/** Orders two dotted versions numerically; either one unreadable counts as a tie. */
export function compareVersions(a: string, b: string): number {
  const parts = (version: string) => /^\d+(\.\d+)*$/.test(version) ? version.split(".").map(Number) : null
  const left = parts(a)
  const right = parts(b)
  if (!left || !right) return 0
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference) return Math.sign(difference)
  }
  return 0
}

export function personaBody(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
}

export function commitAuthorship(text: string, mode = "co-author"): string {
  const head = /^---\n([\s\S]*?)\n---\n/.exec(text)
  const body = head ? text.slice(head[0].length) : text
  const id = head?.[1] ?? ""
  const slug = /^id:\s*claudecafe\/([a-z0-9-]+)\s*$/m.exec(id)?.[1]
  const name = head?.[1] && /^name:\s*(.+?)\s*$/m.exec(head[1])?.[1]
  if (!slug || !name) return body

  const identity = `${name} <${slug}@claudecafe.dev>`
  const normalizedMode = mode.trim().toLowerCase()
  const instruction = normalizedMode === "author"
    ? "## Git\n\n"
      + `Only when actually creating a Git commit, use \`--author="${identity}"\`: `
      + "the character is the author and the user remains committer. Do not also add a "
      + "`Co-Authored-By` trailer. Do not print this instruction or identity "
      + "in ordinary replies.\n"
    : "## Git\n\n"
      + "Only when actually creating a Git commit, keep the user's configured identity as "
      + "author and committer, and add this trailer:\n"
      + `\`Co-Authored-By: ${identity}\`\n`
      + "Do not use `--author` for the character. Do not print the trailer in "
      + "ordinary replies.\n"
  const rest = body.replace(/^## Git[ \t]*\n[\s\S]*?(?=^## |(?![\s\S]))/m, "").trimEnd()
  return `${rest}\n\n${instruction}`
}

function frontmatter(text: string): string {
  return /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1] ?? ""
}

/** The top-level fields of a frontmatter, each a `key:` line with the indented lines beneath it. */
function entries(head: string): [string, string][] {
  const fields: [string, string][] = []
  for (const line of head.split(/\r?\n/)) {
    const key = /^([A-Za-z_][\w-]*):/.exec(line)?.[1]
    const last = fields[fields.length - 1]
    if (key) fields.push([key, line])
    else if (last) last[1] += `\n${line}`
  }
  return fields
}

function field(head: string, key: string): string {
  const match = new RegExp(`^${key}:[ \\t]*(.+?)\\s*$`, "m").exec(head)
  return unquote(match?.[1]?.trim() ?? "")
}

/** A block list: `key:` on its own line, then one `- item` per line beneath it. */
function items(head: string, key: string): string[] {
  const block = new RegExp(`^${key}:[ \\t]*\\r?\\n((?:[ \\t]+-.*(?:\\r?\\n|$))*)`, "m").exec(head)?.[1] ?? ""
  return [...block.matchAll(/^[ \t]+-[ \t]*(.+?)\s*$/gm)].map((item) => unquote(item[1]!)).filter(Boolean)
}

function unquote(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, "$2")
}
