import { marked } from 'marked'
import { text } from '@/i18n'
import type { SceneShare } from '@/agent'
import { TodoBoard } from './TodoBoard'

/**
 * Her last answer, whole, in a window of its own, under her task list while
 * she works. The box she speaks in stops short of her shoulders and scrolls;
 * this is somewhere to read the answer at full height beside her, and it moves
 * on to the next one as she says it.
 */
export function ReplyWindow({ log, todos }: { log: SceneShare['log']; todos: SceneShare['todos'] }) {
  const t = text().reply
  const reply = [...log.messages].reverse().find((message) => message.role === 'assistant')

  return (
    <main className="flex h-screen flex-col gap-6 overflow-y-auto bg-card px-[clamp(20px,6vw,72px)] py-8 text-card-foreground">
      {todos.length > 0 && (
        <div className="mx-auto w-full max-w-[760px]">
          <TodoBoard todos={todos} />
        </div>
      )}
      {reply ? (
        <div
          key={reply.id}
          className="report-md mx-auto w-full max-w-[760px] [&>*:last-child]:mb-0"
          dangerouslySetInnerHTML={{ __html: marked.parse(reply.content, { async: false, breaks: true }) }}
        />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>
      )}
    </main>
  )
}
