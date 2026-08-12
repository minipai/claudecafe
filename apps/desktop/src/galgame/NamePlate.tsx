import { Spinner } from '@/components/ui/spinner'
import type { Expression } from './types'

const KAOMOJI: Record<Expression, string> = {
  neutral: '•ᴗ•',
  happy: '(˶ˆᗜˆ˵)',
  focused: '(๑•̀ ᴗ•́)૭✧',
}

/**
 * Galgame-style speaker plate floating over the dialogue frame's top-left
 * corner. Shows the kaomoji matching the sprite's current expression, or a
 * spinner in its place while the agent is working.
 */
export function NamePlate({
  expression = 'neutral',
  isLoading = false,
}: {
  expression?: Expression
  isLoading?: boolean
}) {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-lg bg-primary px-4 py-1.5 shadow-md">
      <span className="text-sm font-semibold tracking-[0.2em] text-primary-foreground">
        ことね
      </span>
      {isLoading ? (
        <Spinner className="size-3.5 text-primary-foreground/75" />
      ) : (
        <span className="text-xs text-primary-foreground/75">{KAOMOJI[expression]}</span>
      )}
    </div>
  )
}
