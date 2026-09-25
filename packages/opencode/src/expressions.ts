import {
  defaultFace,
  expressionPrompt,
  expressionToolDescription,
  type Expression,
} from "./character-core/index.ts"
import { readdirSync } from "node:fs"
import { extname } from "node:path"
import type { Character } from "./characters.ts"

export { defaultFace, expressionPrompt, expressionToolDescription }
export type { Expression }

export function loadFaceNames(directory: string): [string, ...string[]] {
  const names = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".gif")
    .map((entry) => entry.name.slice(0, -extname(entry.name).length))
    .sort((a, b) => a.localeCompare(b))

  if (names.length === 0) throw new Error(`No GIF faces found in ${directory}`)
  return names as [string, ...string[]]
}

export function availableFaceNames(character: Character | null): string[] {
  if (!character?.pixelsDir) return []
  try {
    return [...loadFaceNames(character.pixelsDir)]
  } catch {
    return []
  }
}
