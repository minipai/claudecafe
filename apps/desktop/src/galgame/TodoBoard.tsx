import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import type { Todo } from '@/agent'
import { cn } from '@/lib/utils'
import { text } from '@/i18n'

/**
 * The model's own task list, pinned to the corner while it works. Written
 * wholesale on every TodoWrite, so it just re-renders from the latest list.
 */
export function TodoBoard({ todos }: { todos: Todo[] }) {
  const done = todos.filter((todo) => todo.status === 'completed').length

  return (
    <AnimatePresence>
      {todos.length > 0 && (
        <motion.div
          className="absolute top-6 left-6 z-[7] w-56 rounded-lg border border-border bg-card/85 px-3.5 py-3 shadow-sm backdrop-blur"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.25 }}
        >
          <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
            <span>{text().scene.tasks}</span>
            <span className="tabular-nums">
              {done}/{todos.length}
            </span>
          </div>

          <ul className="flex flex-col gap-1.5">
            {todos.map((todo) => (
              <li key={todo.content} className="flex items-start gap-2 text-xs leading-[1.6]">
                <span className="mt-[3px] flex size-3 shrink-0 items-center justify-center">
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
