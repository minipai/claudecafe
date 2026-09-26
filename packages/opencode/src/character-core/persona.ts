export type ParsedPersona = {
  id: string
  name: string
  version: string
  offDuty: boolean
  body: string
}

export function parsePersona(text: string): ParsedPersona {
  const head = frontmatter(text)
  return {
    id: field(head, "id"),
    name: field(head, "name"),
    version: field(head, "version"),
    offDuty: /^off_duty:\s*(?:true|yes)\b/im.test(head),
    body: personaBody(text),
  }
}

/** The persona files to try, in order: `persona.<variant>.md` when a variant is set, then the default `persona.md`. */
export function personaFiles(variant = ""): string[] {
  return variant ? [`persona.${variant}.md`, "persona.md"] : ["persona.md"]
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

function field(head: string, key: string): string {
  const match = new RegExp(`^${key}:[ \\t]*(.+?)\\s*$`, "m").exec(head)
  return match?.[1]?.trim().replace(/^(['"])(.*)\1$/, "$2") ?? ""
}
