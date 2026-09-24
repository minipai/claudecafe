import { marked } from 'marked'
import { text } from '@/i18n'
import type { SceneShare } from '@/agent'

/**
 * Her last answer, whole, in a window of its own. The box she speaks in stops
 * short of her shoulders and scrolls; this is somewhere to read the answer at
 * full height beside her, and it moves on to the next one as she says it.
 */
export function ReplyWindow({ log }: { log: SceneShare['log'] }) {
  const t = text().reply
  const reply = [...log.messages].reverse().find((message) => message.role === 'assistant')

  return (
    <main className="h-screen overflow-y-auto bg-card px-[clamp(20px,6vw,72px)] py-8 text-card-foreground">
      {reply ? (
        <div
          key={reply.id}
          className="report-md mx-auto max-w-[760px] [&>*:last-child]:mb-0"
          dangerouslySetInnerHTML={{ __html: marked.parse(reply.content, { async: false, breaks: true }) }}
        />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>
      )}
    </main>
  )
}
