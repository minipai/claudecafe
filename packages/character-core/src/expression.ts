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
- The tool changes the real panel image.
- Do not narrate routine expression changes. Continue the user's task normally; this panel adds a visible reaction and does not require shorter replies, roleplay, or a different persona.`
}

/**
 * Every face the maid has a name for, with the kaomoji that stands for it.
 * Whether she has been drawn wearing one is a separate question, and the
 * answer differs per character — see `hasArtwork`.
 *
 * This is the mood table persona-panel's prompts/cues.md hands her: she is told
 * to end each reply with `【 開心 ( ˶ˆᗜˆ˵ ) 】`, picking the kaomoji from that list. So a
 * marker she writes on her own already names a face, and the expression tool
 * offers her exactly the same set under their plain names. Two hand-copied
 * lists drift, so a test holds them against each other.
 *
 * The spacing is not decoration: it is the one part of a kaomoji the lookup
 * ignores, which makes it the only safe way to even out how wide these are —
 * and they sit in a status line, where a marker three times the width of the
 * last one makes the whole row jump.
 */
export const KAOMOJI = {
  // Everyday, at work
  neutral: "( • ᴗ • )",
  happy: "＼(ˆ ᗜ ˆ)／",
  curious: "(づ •. •)?",
  thinking: "( ╭ರ_•́ )",
  focused: "(๑•̀ ᴗ•́)૭✧",
  confused: "( ⊙.⊙ )?",

  // Warm and playful
  proud: "ᕙ( •̀ ᗜ •́)ᕗ",
  smug: "( ｀▽´ )",
  excited: "٩(ˊᗜˋ*)و",
  flirty: "( ˘ ³˘)♡",
  smitten: "(,,ᴗ ᴗ,,)♡",
  wink: "☆ ( ＞◡❛)",
  embarrassed: "( ˶>﹏<˶ᵕ)",
  pouty: "( •̀ ε •́ )",
  worried: "(´･ω･｀)",
  annoyed: "(￢_￢)",

  // The basic six, and the seventh nobody agreed on
  sad: "(｡•́︿•̀｡)",
  surprised: "Σ( °口° )",
  angry: "( ＃•̀_•́ )",
  afraid: "( ;ﾟдﾟ )",
  skeptical: "(￢‸￢)…",

  // Something went wrong
  frustrated: "(,,>﹏<,,)",
  awkward: "( ^_^; )",
  sorry: "m( _ _ )m",
  speechless: "(・_・;)",
  relieved: "( ˘ᗜ˘ )⁼³",

  // Conversational reactions
  laughing: "ꉂ(ˊᗜˋ*)",
  crying: "(╥﹏╥)",
  sleepy: "(－ω－) zzZ",
  pleading: "(｡•́人•̀｡)",
  facepalm: "(－‸ლ)",
  waving: "( ･ω･)ﾉ",
} as const

export type Mood = keyof typeof KAOMOJI

/** The face a reply ends on: the kaomoji in its closing mood marker, if any. */
export function markedFace(reply: string): Mood | null {
  const marker = reply.match(/【[^【】]*】\s*$/)
  return marker ? faceFor(marker[0]) : null
}

/**
 * Which face a mood marker is wearing. The kaomoji are copied by hand into her
 * replies, so a stray space or a missing bracket shouldn't cost her the face —
 * the match is on the marker's letters and symbols with the spacing dropped.
 */
export function faceFor(marker: string): Mood | null {
  const worn = bare(marker)
  for (const [expression, kaomoji] of Object.entries(KAOMOJI)) {
    if (worn.includes(bare(kaomoji))) return expression as Mood
  }
  return null
}

const bare = (text: string) => text.replace(/\s+/g, "")
