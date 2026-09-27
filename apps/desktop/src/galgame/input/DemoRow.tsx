import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

type DemoTask = {
  label: string
  title: string
}

type DemoRowProps = {
  onSelect: (prompt: string) => void
}

/**
 * The errands a visitor can send her on while nothing is behind her, standing
 * where the prompt box would. Each one is a thing you would actually say to
 * her, and the mock stream matches on the words.
 */
const TASKS: DemoTask[] = [
  { label: 'What can you do?', title: 'She answers for herself — the short path, no tools' },
  { label: 'Show me all your faces', title: 'The face is hers to pick, turn by turn' },
  { label: 'Go and catch a bug', title: 'She works on her own — and asks before she changes anything' },
]

export function DemoRow({ onSelect }: DemoRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-[24px] border border-border bg-card/96 p-2.5 shadow-[0_4px_16px_#33202512]">
      <div className="flex min-w-0 flex-1 flex-wrap gap-2 px-1">
        {TASKS.map((task) => (
          <form key={task.label} onSubmit={(event) => { event.preventDefault(); onSelect(task.label) }}>
            <Button type="submit" variant="outline" title={task.title}>
              {task.label}
            </Button>
          </form>
        ))}
      </div>
      {/* Only the look of the real box's send button: the errands send themselves. */}
      <Button type="button" size="icon" className="size-9 shrink-0 rounded-full" disabled aria-hidden tabIndex={-1}>
        <ArrowUp />
      </Button>
    </div>
  )
}
