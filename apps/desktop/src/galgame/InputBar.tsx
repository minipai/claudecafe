import { useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { CommandMenu } from './CommandMenu'
import { Attachments, readImage, type Pending } from './Attachments'
import type { Attachment, CafeCommand } from '@/agent'

type InputBarProps = {
  isBusy: boolean
  /** What `/` offers in this folder; empty until the session has said. */
  commands: CafeCommand[]
  onSubmit: (text: string, images: Attachment[]) => void
  onStop: () => void
}

/** Typing never stops: a prompt sent while she is working queues behind the
 * one she is on, and the stop button is there to cut her off instead. */
export function InputBar({ isBusy, commands, onSubmit, onStop }: InputBarProps) {
  const [text, setText] = useState('')
  /** Pictures handed over for this prompt, waiting above the input. */
  const [pending, setPending] = useState<Pending[]>([])
  const [active, setActive] = useState(0)
  /** Escaped out of the list — it stays shut until the command being typed changes. */
  const [dismissed, setDismissed] = useState(false)

  const typing = commandBeingTyped(text)
  const matches = typing === null || dismissed ? [] : match(commands, typing)
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
      // A picture dropped on the scene is handed to her; a file is named to her.
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return
        event.preventDefault()
        void attach([...event.dataTransfer.files])
      }}
    >
      {pending.length > 0 && (
        <Attachments
          pending={pending}
          onRemove={(id) => setPending((current) => current.filter((image) => image.id !== id))}
        />
      )}
      {matches.length > 0 && (
        <CommandMenu matches={matches} active={matches.indexOf(highlighted)} onPick={pick} />
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          // A picture on its own is worth sending; she will ask what about it.
          if (!text.trim() && !pending.length) return
          onSubmit(text, pending.map(({ mediaType, data }) => ({ mediaType, data })))
          setText('')
          setPending([])
          setDismissed(false)
        }}
      >
        <Textarea
          value={text}
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
            if (matches.length > 0) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const step = e.key === 'ArrowDown' ? 1 : matches.length - 1
                setActive((current) => (Math.min(current, matches.length - 1) + step) % matches.length)
                return
              }
              // Enter picks what is highlighted instead of sending: `/pl` is not
              // a prompt anyone means to send.
              if ((e.key === 'Enter' || e.key === 'Tab') && !e.nativeEvent.isComposing) {
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
          placeholder="Say something to ことね…"
          className="min-h-8 resize-none border-none bg-transparent shadow-none focus-visible:ring-0"
        />
        {isBusy ? (
          <Button type="button" size="icon-sm" aria-label="Stop" onClick={onStop}>
            <Square fill="currentColor" className="size-2.5" />
          </Button>
        ) : (
          <Button type="submit" size="icon-sm" disabled={!text.trim() && !pending.length} aria-label="Send">
            <ArrowUp />
          </Button>
        )}
      </form>
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

/** Commands the typed name could still become, the ones that start with it first. */
function match(commands: CafeCommand[], typed: string) {
  const wanted = typed.toLowerCase()
  const starts = commands.filter((command) => command.name.toLowerCase().startsWith(wanted))
  const contains = commands.filter(
    (command) => !command.name.toLowerCase().startsWith(wanted) && command.name.toLowerCase().includes(wanted),
  )
  return [...starts, ...contains]
}
