import { Button } from '@/components/ui/button'

type DemoTask = {
  tag: string
  label: string
  title: string
}

type DemoRowProps = {
  isDisabled: boolean
  onSelect: (prompt: string) => void
}

/** Each demo prompt doubles as its own tier hint — the mock stream matches on the label text. */
const TASKS: DemoTask[] = [
  { tag: 'S', label: 'Ask a quick question', title: 'Short response: dialogue only' },
  { tag: 'M', label: 'Explain this code', title: 'Medium response: expands in place' },
  { tag: 'L', label: 'Investigate a bug', title: 'Long response: opens a full report' },
  { tag: 'P', label: 'Plan the fix', title: 'Plan mode: hands over a plan for approval first' },
  { tag: '!', label: 'Simulate a failure', title: 'Error handling: the run fails mid-flight' },
]

export function DemoRow({ isDisabled, onSelect }: DemoRowProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TASKS.map((task) => (
        <Button
          key={task.tag}
          variant="outline"
          size="sm"
          title={task.title}
          disabled={isDisabled}
          onClick={() => onSelect(task.label)}
        >
          {task.tag}・{task.label}
        </Button>
      ))}
    </div>
  )
}
