export function fillPrompt(template: string, values: Record<string, string> = {}): string {
  return template
    .replace(
      /\$\$|\$([a-zA-Z_]\w*)|\$\{([a-zA-Z_]\w*)\}/g,
      (match, bare: string | undefined, braced: string | undefined) => {
        if (match === "$$") return "$"
        const key = bare ?? braced ?? ""
        return Object.prototype.hasOwnProperty.call(values, key) ? (values[key] ?? match) : match
      },
    )
    .replace(/\n+$/, "")
}
