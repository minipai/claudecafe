import { useId, useState, type ReactNode, type RefObject } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { CommandMenu } from './CommandMenu'
import { Attachments, readImage, type Pending } from './Attachments'
import { fill, her, text as ui } from '@/i18n'
import type { Attachment, CafeCommand } from '@/agent'

type InputBarProps = {
  isBusy: boolean
  /** What `/` offers in this folder; empty until the session has said. */
  commands: CafeCommand[]
  onSubmit: (text: string, images: Attachment[]) => void
  onStop: () => void
  footer?: ReactNode
  actions?: ReactNode
  readingGate?: boolean
  composingChange?: (composing: boolean) => void
  inputRef?: RefObject<HTMLTextAreaElement | null>
}

/** Typing never stops: a prompt sent while she is working queues behind the
 * one she is on, and the stop button is there to cut her off instead. */
export function InputBar({ isBusy, commands, onSubmit, onStop, footer, actions, readingGate = false, composingChange, inputRef }: InputBarProps) {
  const formId = useId()
  const t = ui().scene
  const [text, setText] = useState('')
  /** Pictures handed over for this prompt, waiting above the input. */
  const [pending, setPending] = useState<Pending[]>([])
  const [active, setActive] = useState(0)
  /** Escaped out of the list — it stays shut until the command being typed changes. */
  const [dismissed, setDismissed] = useState(false)

  const typing = commandBeingTyped(text)
  const matches = readingGate || typing === null || dismissed ? [] : match(commands, typing)
  const highlighted = matches[Math.min(active, matches.length - 1)]

  function retype(next: string) {
    setText(next)
    setDismissed(false)
    setActive(0)
  }

  /** Take the name and leave the caret where the arguments go; a command that
   * takes none is sent by the next Enter, with nothing else to type. */
  function pick(command: CafeCommand) {
    retype(`/${command.name} `)
  }

  async function attach(files: File[]) {
    const pictures = files.filter((file) => file.type.startsWith('image/'))
    if (pictures.length) {
      const read = await Promise.all(pictures.map(readImage))
      setPending((current) => [...current, ...read])
    }

    // Anything else she can open herself: its path goes into the prompt, which
    // is the same thing the master would have typed.
    const paths = files
      .filter((file) => !file.type.startsWith('image/'))
      .map((file) => window.cafe?.pathFor(file))
      .filter(Boolean)
    if (paths.length) retype(`${text}${text && !text.endsWith(' ') ? ' ' : ''}${paths.join(' ')} `)
  }

  return (
    <div
      // The anchor the command menu floats up from.
      className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 rounded-[24px] border border-border bg-card/96 p-2.5 shadow-[0_4px_16px_#33202512]"
      // A picture dropped on the scene is handed to her; a file is named to her.
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return
        event.preventDefault()
        void attach([...event.dataTransfer.files])
      }}
    >
      {pending.length > 0 && (
        <div className="col-span-2"><Attachments
          pending={pending}
          onRemove={(id) => setPending((current) => current.filter((image) => image.id !== id))}
        /></div>
      )}
      {matches.length > 0 && (
        <CommandMenu matches={matches} active={matches.indexOf(highlighted)} onPick={pick} />
      )}
      <form
        id={formId}
        className="col-span-2 min-w-0"
        onSubmit={(e) => {
          e.preventDefault()
          if (readingGate) return
          // A picture on its own is worth sending; she will ask what about it.
          if (!text.trim() && !pending.length) return
          onSubmit(text, pending.map(({ mediaType, data }) => ({ mediaType, data })))
          setText('')
          setPending([])
          setDismissed(false)
        }}
      >
        <Textarea
          ref={inputRef}
          value={text}
          readOnly={readingGate}
          onCompositionStart={() => composingChange?.(true)}
          onCompositionEnd={() => composingChange?.(false)}
          onChange={(e) => retype(e.target.value)}
          // A screenshot off the clipboard is the usual way the master shows
          // her something, so it is taken as a picture rather than as a path.
          onPaste={(e) => {
            const pictures = [...e.clipboardData.files].filter((file) => file.type.startsWith('image/'))
            if (!pictures.length) return
            e.preventDefault()
            void attach(pictures)
          }}
          onKeyDown={(e) => {
            if (readingGate) {
              if (e.key === ' ' && !e.nativeEvent.isComposing) e.preventDefault()
              return
            }
            if (matches.length > 0) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const step = e.key === 'ArrowDown' ? 1 : matches.length - 1
                setActive((current) => (Math.min(current, matches.length - 1) + step) % matches.length)
                return
              }
              // Enter picks what is highlighted instead of sending: `/pl` is not
              // a prompt anyone means to send. But a name already typed out in
              // full has nothing left to pick — that Enter falls through and
              // runs the command.
              const finished =
                typing !== null && highlighted.name.toLowerCase() === typing.toLowerCase()
              if (
                (e.key === 'Enter' || e.key === 'Tab') &&
                !e.nativeEvent.isComposing &&
                !(e.key === 'Enter' && finished)
              ) {
                e.preventDefault()
                pick(highlighted)
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setDismissed(true)
                return
              }
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={fill(t.say, { her: her() })}
          className="min-h-16 resize-none border-none bg-transparent px-2.5 pt-3 pb-2 text-base leading-[1.45] shadow-none focus-visible:ring-0 md:text-base"
        />
      </form>
      <div className="min-w-0 px-1 pb-1">{footer}</div>
      <div className="flex items-center gap-1">
        {actions}
        {isBusy ? (
          <form onSubmit={(event) => { event.preventDefault(); onStop() }}>
            <Button type="submit" size="icon" className="size-9 rounded-full" aria-label={t.stop}>
              <Square fill="currentColor" className="size-2.5" />
            </Button>
          </form>
          ) : (
            <Button type="submit" form={formId} size="icon" className="size-9 rounded-full" disabled={readingGate || (!text.trim() && !pending.length)} aria-label={t.send}>
              <ArrowUp />
            </Button>
          )}
      </div>
    </div>
  )
}

/**
 * The name half of a slash command, while it is still being typed — `/pl` in
 * `/pl`, `''` on a bare `/`. Null once there is a space after it (the arguments
 * are his own words) or when the line never started with one.
 */
function commandBeingTyped(text: string) {
  const typed = text.match(/^\/(\S*)$/)
  return typed ? typed[1] : null
}

/** Commands the typed name could still become: the one it already is first —
 * `/usage` must not highlight `/usage-credits` — then the ones that start with
 * it, then the ones that merely contain it. */
function match(commands: CafeCommand[], typed: string) {
  const wanted = typed.toLowerCase()
  const ranked = (command: CafeCommand) => {
    const name = command.name.toLowerCase()
    return name === wanted ? 0 : name.startsWith(wanted) ? 1 : name.includes(wanted) ? 2 : 3
  }
  return commands
    .map((command) => ({ command, rank: ranked(command) }))
    .filter(({ rank }) => rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .map(({ command }) => command)
}
