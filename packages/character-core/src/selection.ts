export type CharacterResolution = {
  selected?: string
  session?: string
  config?: string
  pool: readonly string[]
  random?: () => number
}

/** Resolve the character without knowing which host owns the files or session store. */
export function resolveCharacter(input: CharacterResolution): string | null {
  const requested = input.selected || input.session || input.config
  if (requested) return normalizeCharacter(requested) || null

  if (!input.pool.length) return null
  const random = input.random ?? Math.random
  const index = Math.min(input.pool.length - 1, Math.floor(random() * input.pool.length))
  return normalizeCharacter(input.pool[index] ?? "") || null
}

export function normalizeCharacter(value: string): string {
  return value.trim().toLowerCase() === "none" ? "" : value.trim().toLowerCase()
}
