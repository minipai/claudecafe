import { Check } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { Todo } from '@/agent'
import { cn } from '@/lib/utils'
import { text } from '@/i18n'

/**
 * The model's own task list, above her answer in the reply window while she
 * works. Written wholesale on every TodoWrite, so it just re-renders from the
 * latest list.
 */
export function TodoBoard({ todos }: { todos: Todo[] }) {
  const done = todos.filter((todo) => todo.status === 'completed').length

  return (
    <section className="rounded-lg border border-border bg-background/55 px-3.5 py-3">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
        <span>{text().scene.tasks}</span>
        <span className="tabular-nums">
          {done}/{todos.length}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {todos.map((todo) => (
          <li key={todo.content} className="flex items-start gap-2 text-sm leading-[1.6]">
            <span className="mt-[5px] flex size-3 shrink-0 items-center justify-center">
              {todo.status === 'completed' && <Check className="size-3 text-foreground" />}
              {todo.status === 'in_progress' && <Spinner className="size-3 text-foreground" />}
              {todo.status === 'pending' && (
                <span className="size-1.5 rounded-full border border-muted-foreground/60" />
              )}
            </span>
            <span
              className={cn(
                todo.status === 'completed' && 'text-muted-foreground line-through',
                todo.status === 'in_progress' && 'font-medium text-foreground',
                todo.status === 'pending' && 'text-muted-foreground',
              )}
            >
              {todo.content}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
