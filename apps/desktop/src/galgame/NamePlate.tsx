import { KAOMOJI, type Expression } from '@/agent/expressions'

/**
 * Galgame-style speaker plate floating over the dialogue frame's top-left
 * corner. Shows the kaomoji matching the sprite's current expression — that it
 * is her face, whatever she is doing: the waiting line at the foot of the box
 * is the one place that says she is working.
 */
export function NamePlate({ expression = 'neutral' }: { expression?: Expression }) {
  return (
    <div className="inline-flex items-center gap-2.5 rounded-lg bg-primary px-4 py-1.5 shadow-md">
      <span className="text-sm font-semibold tracking-[0.2em] text-primary-foreground">
        ことね
      </span>
      <span className="text-xs text-primary-foreground/75">{KAOMOJI[expression]}</span>
    </div>
  )
}
