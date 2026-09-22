import { readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, extname, join } from "node:path"

const charactersRoot = dirname(createRequire(import.meta.url).resolve("@claudecafe/characters/package.json"))

export const FACE_DIRECTORY = join(charactersRoot, "kotone", "pixels")

export type Expression = {
  mood: string
  face: string
}

export function loadFaceNames(directory = FACE_DIRECTORY): [string, ...string[]] {
  const names = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".gif")
    .map((entry) => entry.name.slice(0, -extname(entry.name).length))
    .sort((a, b) => a.localeCompare(b))

  if (names.length === 0) throw new Error(`No GIF faces found in ${directory}`)
  return names as [string, ...string[]]
}

export function defaultFace(faces: readonly string[]): string {
  return faces.includes("neutral") ? "neutral" : faces[0]!
}

export function expressionToolDescription(faces: readonly string[]): string {
  return (
    "Change your current mood label and visible portrait in the Café panel. " +
    "Mood is a short, freely chosen description of your present emotional tone, such as focused, relieved, or quietly delighted. It is not an activity, task name, subject, or progress update. " +
    "Face selects the artwork and may differ when the outward expression does not directly reveal the mood. " +
    "Use when your mood or visible expression meaningfully changes, or when the user asks; do not call on every reply or repeat the current state. " +
    `Available faces: ${faces.join(", ")}. ` +
    "The selection stays until changed and is independent of the text mood marker."
  )
}

export const expressionPrompt = `The user can see your character standing in a panel beside this terminal conversation. Keep both the mood label beside your name and your visible face in step with what you are saying and doing.

- Call set_expression with a freely worded, short mood and one available face when either meaningfully changes, without waiting to be asked. The mood describes only your inner emotional tone, never your activity, task, subject, or progress; the face is what the user sees, so they may deliberately differ.
- Change them before the reply or work they accompany. Keep it natural: one change for a meaningful shift, not a call on every message or a repeat of the current state. They stay until the next call.
- Choose a face whose filename best fits the visible performance. Use intimate or strongly suggestive faces only when the conversation suits them.
- The tool changes the real panel and its mood label. A written mood marker alone does not change either. If a persona asks for mood markers, keep following that instruction too.
- Do not narrate routine expression changes. Continue the user's task normally; this panel adds a visible reaction and does not require shorter replies, roleplay, or a different persona.`
