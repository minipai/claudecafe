import { Button } from '@/components/ui/button'

type DemoTask = {
  label: string
  title: string
}

type DemoRowProps = {
  isDisabled: boolean
  onSelect: (prompt: string) => void
}

/**
 * The errands a visitor can send her on while nothing is behind her. Each one
 * is a thing you would actually say to her, and the mock stream matches on the
 * words. Anything else typed into the box gets the truth: there is no model
 * out here to answer it.
 */
const TASKS: DemoTask[] = [
  { label: 'What can you do?', title: 'She answers for herself — the short path, no tools' },
  { label: 'Show me all your faces', title: 'The face is hers to pick, turn by turn' },
  { label: 'What are you up to?', title: 'A peek at what she is doing between errands' },
]

export function DemoRow({ isDisabled, onSelect }: DemoRowProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TASKS.map((task) => (
        <Button
          key={task.label}
          variant="outline"
          size="sm"
          title={task.title}
          disabled={isDisabled}
          onClick={() => onSelect(task.label)}
        >
          {task.label}
        </Button>
      ))}
    </div>
  )
}
