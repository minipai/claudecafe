import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ChevronRight, Plus, Shrink, X } from 'lucide-react'
import { marked } from 'marked'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fill, her, text } from '@/i18n'
import type { ChatMessage } from './types'

type ChatHistoryProps = {
  open: boolean
  messages: ChatMessage[]
  /** True while a run is in flight — compacting mid-turn is not allowed. */
  isBusy: boolean
  isCompacting: boolean
  /** True while ことね is waiting on a permission answer back in the scene. */
  isAwaitingAnswer: boolean
  onClose: () => void
  onCompact: () => void
  onNewSession: () => void
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp)
}

export function ChatHistory({
  open,
  messages,
  isBusy,
  isCompacting,
  isAwaitingAnswer,
  onClose,
  onCompact,
  onNewSession,
}: ChatHistoryProps) {
  const t = text()
  /** Which tool answers the master has opened — his reading, not the log's. */
  const [opened, setOpened] = useState<Set<number>>(new Set())

  function toggle(id: number) {
    setOpened((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  // Everything before the last compaction now lives on as a summary, so it is dimmed.
  const lastBoundary = messages.map((message) => message.role).lastIndexOf('boundary')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, messages])

  function jumpToLatest() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent showCloseButton={false} className="flex h-[min(760px,86vh)] w-[min(960px,90vw)] max-w-none flex-col gap-0 overflow-hidden border border-border bg-card/80 p-0 shadow-xl backdrop-blur-xl sm:max-w-[960px]">
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-4 py-2.5 text-left">
          <DialogTitle className="text-sm font-medium text-foreground">
            {t.log.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {messages.length === 1 ? t.log.oneMessage : fill(t.log.messages, { count: messages.length })}
          </DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t.log.close}>
              <X />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-[clamp(20px,6vw,72px)] py-5"
        >
              <div className="relative mx-auto max-w-[760px]">
                {messages.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {t.log.empty}
                  </p>
                )}
                {messages.map((message, index) => {
                  const isUser = message.role === 'user'
                  const isEvent = message.role === 'event'
                  const isSummarised = index < lastBoundary

                  if (message.role === 'boundary') {
                    return (
                      <div key={message.id} className="flex items-center gap-3 py-5 pl-[142px]">
                        <span className="h-px flex-1 bg-border" />
                        <span className="font-mono text-[10px] tracking-[0.12em] whitespace-nowrap text-muted-foreground">
                          {message.content.toUpperCase()} · {formatTime(message.createdAt)}
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    )
                  }
                  const hasNext = index < messages.length - 1
                  const nextStartsTurn = messages[index + 1]?.role === 'user'

                  if (isEvent) {
                    const answered = message.output !== undefined && message.output !== ''
                    const shown = opened.has(message.id)
                    return (
                      <article
                        key={message.id}
                        className={`relative py-1.5 pl-[142px] ${isSummarised ? 'opacity-45' : ''}`}
                      >
                        {hasNext && (
                          <span
                            aria-hidden="true"
                            className="absolute top-0 left-[125px] w-px bg-border/80"
                            style={{ bottom: nextStartsTurn ? -12 : 0 }}
                          />
                        )}
                        <span
                          aria-hidden="true"
                          className={`absolute top-[9px] left-[123px] z-10 size-[5px] rounded-full ${
                            message.failed ? 'bg-destructive' : 'bg-border'
                          }`}
                        />
                        {/* A call that has been answered opens: what came back is
                            the half of the record that says whether it worked. */}
                        <button
                          type="button"
                          disabled={!answered}
                          onClick={() => toggle(message.id)}
                          className="flex w-full items-baseline gap-2 text-left text-xs text-muted-foreground disabled:cursor-default"
                        >
                          {answered && (
                            <ChevronRight
                              className={`size-3 shrink-0 self-center transition-transform ${shown ? 'rotate-90' : ''}`}
                            />
                          )}
                          <span className={message.failed ? 'text-destructive' : undefined}>
                            {message.content}
                          </span>
                          {message.detail && (
                            <code className="truncate font-mono text-[11px] opacity-80">{message.detail}</code>
                          )}
                        </button>
                        {answered && shown && (
                          <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border border-border bg-muted/60 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/80">
                            {message.output}
                          </pre>
                        )}
                      </article>
                    )
                  }

                  return (
                    <article
                      key={message.id}
                      className={`relative py-4 pl-[142px] ${isUser && index > 0 ? 'mt-3' : ''} ${
                        isSummarised ? 'opacity-45' : ''
                      }`}
                    >
                      {hasNext && (
                        <span
                          aria-hidden="true"
                          className="absolute top-[27px] left-[125px] w-px bg-border/80"
                          style={{ bottom: nextStartsTurn ? -39 : -27 }}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`absolute top-[23px] left-[121px] z-10 size-[9px] rounded-full ${
                          isUser
                            ? 'border border-foreground/45 bg-card'
                            : 'border-2 border-card bg-foreground/80'
                        }`}
                      />

                      <time
                        dateTime={new Date(message.createdAt).toISOString()}
                        className="absolute top-[20px] left-0 w-28 text-right font-mono text-[10px] whitespace-nowrap text-muted-foreground tabular-nums"
                      >
                        {formatTime(message.createdAt)}
                      </time>

                      <div className="mb-1.5">
                        <div
                          className={`text-xs font-semibold ${
                            isUser ? 'text-foreground/60' : 'text-foreground/85'
                          }`}
                        >
                          {isUser ? t.log.you : her()}
                        </div>
                      </div>

                      <div className="text-[15px] leading-[1.8] text-foreground sm:text-base">
                        {/* Her side of the record is read as markdown, the same
                            as everywhere else she is quoted — the log is where
                            the long answers with lists and code in them end up.
                            The master's own words are left exactly as he typed
                            them: a path with underscores in it is a path, not
                            an instruction to set something in italics. */}
                        {isUser ? (
                          <span className="whitespace-pre-wrap">{message.content}</span>
                        ) : (
                          <div
                            className="report-md text-[15px] leading-[1.8] sm:text-base [&>*:last-child]:mb-0"
                            dangerouslySetInnerHTML={{
                              __html: marked.parse(message.content, { async: false, breaks: true }),
                            }}
                          />
                        )}
                        {message.report && (
                          <details className="mt-3 whitespace-normal">
                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                              {message.report.label}
                            </summary>
                            <div
                              className="report-md mt-4 rounded-lg border border-border/80 bg-background/55 p-5 text-sm"
                              dangerouslySetInnerHTML={{
                                __html: marked.parse(message.report.body, { async: false }),
                              }}
                            />
                          </details>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
        </div>

        <DialogFooter className="mx-0 mb-0 flex-row items-center justify-between rounded-none border-t bg-transparent px-4 py-3 sm:justify-between">
          <div className="flex items-center gap-1">
            <p className="mr-2 text-xs text-muted-foreground">
              {messages.length === 1 ? t.log.oneMessage : fill(t.log.messages, { count: messages.length })}
            </p>
            <Button variant="ghost" className="text-xs text-muted-foreground" onClick={jumpToLatest}>
              <ArrowDown data-icon="inline-start" />
              {t.log.latest}
            </Button>
          </div>

          {/* Both actions act on this session's memory, so they live with it. */}
          <div className="flex items-center gap-1">
            {isAwaitingAnswer && (
              <Button size="sm" className="mr-2 text-xs" onClick={onClose}>
                {fill(t.log.waiting, { her: her() })}
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-xs text-muted-foreground"
              disabled={isBusy || isCompacting}
              title={t.log.compactHint}
              onClick={onCompact}
            >
              <Shrink data-icon="inline-start" />
              {isCompacting ? t.log.compacting : t.log.compact}
            </Button>
            <Button
              variant="ghost"
              className="text-xs text-muted-foreground"
              title={t.log.newSessionHint}
              onClick={onNewSession}
            >
              <Plus data-icon="inline-start" />
              {t.log.newSession}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
