export type MaidResolution = {
  selected?: string
  env?: string
  shift?: string
  config?: string
  pool: readonly string[]
  random?: () => number
}

/** Resolve the maid without knowing which host owns the files or session store. */
export function resolveMaid(input: MaidResolution): string | null {
  const requested = input.selected || input.env || input.shift || input.config
  if (requested) return normalizeMaid(requested) || null

  if (!input.pool.length) return null
  const random = input.random ?? Math.random
  const index = Math.min(input.pool.length - 1, Math.floor(random() * input.pool.length))
  return normalizeMaid(input.pool[index] ?? "") || null
}

export function normalizeMaid(value: string): string {
  return value.trim().toLowerCase() === "none" ? "" : value.trim().toLowerCase()
}
