/**
 * Every face the maid has a name for, with the kaomoji that stands for it.
 * Whether she has been drawn wearing one is a separate question, and the
 * answer differs per character — see `hasArtwork`.
 *
 * This is the café plugin's own mood table, copied verbatim: she is told to end
 * each reply with `【 開心 (˶ˆᗜˆ˵) 】`, picking the kaomoji from that list. So a
 * marker she writes on her own already names a face, and the expression tool
 * offers her exactly the same set under their plain names.
 */
export const KAOMOJI = {
  neutral: '•ᴗ•',
  happy: '(˶ˆᗜˆ˵)',
  curious: '(づ •. •)?',
  thinking: '(╭ರ_•́)',
  focused: '(๑•̀ ᴗ•́)૭✧',
  proud: 'ᕙ( •̀ ᗜ •́)ᕗ',
  embarrassed: '( ˶>﹏<˶ᵕ)',
  frustrated: '(,,>﹏<,,)',
  confused: '(⊙.⊙)?',
  surprised: 'Σ(°口°)',
  sad: '(｡•́︿•̀｡)',
  flirty: '(¬‿¬ )',
  horny: '(⁄ ⁄•⁄ω⁄•⁄ ⁄)',
} as const

export type Expression = keyof typeof KAOMOJI

export const EXPRESSIONS = Object.keys(KAOMOJI) as [Expression, ...Expression[]]

/**
 * Which face a mood marker is wearing. The kaomoji are copied by hand into her
 * replies, so a stray space or a missing bracket shouldn't cost her the face —
 * the match is on the marker's letters and symbols with the spacing dropped.
 */
export function faceFor(marker: string): Expression | null {
  const worn = bare(marker)
  for (const [expression, kaomoji] of Object.entries(KAOMOJI)) {
    if (worn.includes(bare(kaomoji))) return expression as Expression
  }
  return null
}

const bare = (text: string) => text.replace(/\s+/g, '')
