import { useEffect, useRef } from 'react'
import { ArrowDown, Plus, Shrink, X } from 'lucide-react'
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
  return new Intl.DateTimeFormat('zh-TW', {
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
            BACKLOG
          </DialogTitle>
          <DialogDescription className="sr-only">
            Contains {messages.length} {messages.length === 1 ? 'message' : 'messages'}.
          </DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close conversation history">
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
                    Nothing here yet — this session just started.
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
                          className="absolute top-[9px] left-[123px] z-10 size-[5px] rounded-full bg-border"
                        />
                        <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                          <span>{message.content}</span>
                          {message.detail && (
                            <code className="truncate font-mono text-[11px] opacity-80">{message.detail}</code>
                          )}
                        </div>
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
                          {isUser ? 'ご主人様' : 'ことね'}
                        </div>
                      </div>

                      <div className="text-[15px] leading-[1.8] whitespace-pre-wrap text-foreground sm:text-base">
                        {message.content}
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
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </p>
            <Button variant="ghost" className="text-xs text-muted-foreground" onClick={jumpToLatest}>
              <ArrowDown data-icon="inline-start" />
              Jump to latest
            </Button>
          </div>

          {/* Both actions act on this session's memory, so they live with it. */}
          <div className="flex items-center gap-1">
            {isAwaitingAnswer && (
              <Button size="sm" className="mr-2 text-xs" onClick={onClose}>
                Kotone is waiting for an answer
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-xs text-muted-foreground"
              disabled={isBusy || isCompacting}
              title="Summarise older turns to free up context"
              onClick={onCompact}
            >
              <Shrink data-icon="inline-start" />
              {isCompacting ? 'Compacting…' : 'Compact'}
            </Button>
            <Button
              variant="ghost"
              className="text-xs text-muted-foreground"
              title="Start over in this folder"
              onClick={onNewSession}
            >
              <Plus data-icon="inline-start" />
              New session
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
