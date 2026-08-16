import { useEffect, useRef } from 'react'
import type { CafeCommand } from '@/agent'

type CommandMenuProps = {
  matches: CafeCommand[]
  active: number
  onPick: (command: CafeCommand) => void
}

/**
 * What `/` offers, over the input he is typing it into — floating over it,
 * not stacked on it: a list that takes part in layout shoves the input around
 * under the caret every time it opens. The list is the session's own —
 * built-ins, this folder's commands, its skills and plugins — so it is as
 * long as the project makes it and scrolls rather than being cut.
 */
export function CommandMenu({ matches, active, onPick }: CommandMenuProps) {
  const list = useRef<HTMLDivElement>(null)

  // Arrowing past the edge should bring the next one into view, not walk the
  // highlight off the bottom of the list.
  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <div
      ref={list}
      role="listbox"
      className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md"
    >
      {matches.map((command, index) => (
        <button
          key={command.name}
          type="button"
          role="option"
          aria-selected={index === active}
          // The pointer must not take focus off the input: he is still typing,
          // and the caret going away would close what he is aiming at.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(command)}
          className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm ${
            index === active ? 'bg-accent text-accent-foreground' : 'text-foreground'
          }`}
        >
          <span className="shrink-0 font-mono text-[13px]">/{command.name}</span>
          {command.argumentHint && (
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {command.argumentHint}
            </span>
          )}
          <span className="truncate text-xs text-muted-foreground">{summarise(command.description)}</span>
        </button>
      ))}
    </div>
  )
}

/** A skill's description is a paragraph written for the model to match on; the
 * row has one line, so it gets the first sentence of it. */
function summarise(description: string) {
  const first = description.split(/(?<=\.)\s|\n/)[0]?.trim() ?? ''
  return first.length > 110 ? `${first.slice(0, 108)}…` : first
}
