import { KAOMOJI } from '@claudecafe/character-core'

export { faceFor, KAOMOJI } from '@claudecafe/character-core'

export type Expression = keyof typeof KAOMOJI

export const EXPRESSIONS = Object.keys(KAOMOJI) as [Expression, ...Expression[]]
