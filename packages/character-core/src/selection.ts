/** Who is on shift when nobody was chosen: the same maid every time, so a resumed session (which gets a new id) cannot come back as another. */
export const DEFAULT_CHARACTER = "kotone"

export type CharacterResolution = {
  selected?: string
  session?: string
  config?: string
  pool: readonly string[]
}

/** Resolve the character without knowing which host owns the files or session store. */
export function resolveCharacter(input: CharacterResolution): string | null {
  const requested = input.selected || input.session || input.config
  if (requested) return normalizeCharacter(requested) || null

  const fallback = input.pool.includes(DEFAULT_CHARACTER) ? DEFAULT_CHARACTER : input.pool[0]
  return normalizeCharacter(fallback ?? "") || null
}

export function normalizeCharacter(value: string): string {
  return value.trim().toLowerCase() === "none" ? "" : value.trim().toLowerCase()
}
