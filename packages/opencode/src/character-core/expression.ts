export type Expression = {
  character: string | null
  face: string
}

export function defaultFace(faces: readonly string[]): string {
  return faces.includes("neutral") ? "neutral" : faces[0] ?? "neutral"
}

export function expressionToolDescription(faces: readonly string[]): string {
  const available = faces.length ? `Available faces: ${faces.join(", ")}. ` : "No GIF faces are installed for this character. "
  return (
    "Change the visible portrait in the character panel. "
    + "Choose one available face when your visible expression meaningfully changes, or when the user asks; do not call on every reply or repeat the current state. "
    + available
    + "The panel shows only the face; it has no mood field. The selection stays until changed."
  )
}

export function expressionPrompt(toolName = "set_expression"): string {
  return `The user can see your character standing in a panel beside this terminal conversation. Keep the visible face in step with what you are saying and doing.

- Call ${toolName} with one available face when the visible expression meaningfully changes, without waiting to be asked.
- Change the face before the reply or work it accompanies. Keep it natural: one change for a meaningful shift, not a call on every message or a repeat of the current state. It stays until the next call.
- Choose a face whose filename best fits the visible performance. Use intimate or strongly suggestive faces only when the conversation suits them.
- The tool changes the real panel image. A written mood marker is independent of the panel and does not change the face.
- Do not narrate routine expression changes. Continue the user's task normally; this panel adds a visible reaction and does not require shorter replies, roleplay, or a different persona.`
}
