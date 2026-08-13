import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  Clock,
  FolderOpen,
  FolderSearch,
  Gauge,
  MessageSquarePlus,
  Plug,
  ScrollText,
  Search,
  ShieldCheck,
  Shrink,
  UserCog,
  Users,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Conversation, SessionSettings } from '@/agent'

/** One thing the window can do, or one place it can go. */
type Entry = {
  key: string
  icon: typeof FolderOpen
  label: string
  note?: string
  /** Leads to a list of its own rather than doing something. */
  into?: 'folder' | 'conversation' | 'mode'
  run?: () => void
  /** Where she already is: shown to say so, not offered as somewhere to go. */
  here?: boolean
}

type Doing = {
  onNewSession: () => void
  onOpenHistory: () => void
  onCompact: () => void
  onOpenPanel: (command: '/usage' | '/context' | '/agents' | '/mcp' | '/status') => void
  /** How much she asks before doing, and how it is changed. */
  mode: SessionSettings['mode']
  onMode: (mode: SessionSettings['mode']) => void
}

/** The permission modes, worded as the CLI words them, with what each one means
 * for the master standing there watching. */
const MODES: { value: SessionSettings['mode']; label: string; note: string }[] = [
  { value: 'default', label: 'Ask before acting', note: 'default' },
  { value: 'auto', label: 'Decide for herself', note: 'auto' },
  { value: 'acceptEdits', label: 'Edit files without asking', note: 'accept edits' },
  { value: 'plan', label: 'Plan first, do nothing yet', note: 'plan' },
]

/**
 * ⌘K: what she can be asked to do that is not said out loud — go somewhere,
 * start over, show her books. The commands come first; the ones that need a
 * target (a folder, a conversation) open their own list rather than mixing
 * every folder and every conversation into one pile.
 */
export function CommandBar({
  open,
  folder,
  conversation,
  doing,
  onClose,
}: {
  open: boolean
  /** Where she is now, so the list can say so instead of offering it. */
  folder: string
  conversation: string | null
  doing: Doing
  /** `moved` when she was sent somewhere — the scene starts over on it. */
  onClose: (moved: boolean) => void
}) {
  const [step, setStep] = useState<'commands' | 'folder' | 'conversation' | 'mode'>('commands')
  const [typed, setTyped] = useState('')
  const [active, setActive] = useState(0)
  const [folders, setFolders] = useState<string[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const list = useRef<HTMLDivElement>(null)

  // Read on the way in: a folder she was sent to a minute ago belongs at the
  // top, and a conversation started since then belongs in the list at all.
  useEffect(() => {
    if (!open) return
    setStep('commands')
    setTyped('')
    setActive(0)
    void window.cafe?.folders().then(setFolders)
    void window.cafe?.conversations().then(setConversations)
  }, [open])

  const commands: Entry[] = [
    { key: 'folder', icon: FolderOpen, label: 'Work somewhere else', note: shorten(folder), into: 'folder' },
    { key: 'resume', icon: Clock, label: 'Go back to a conversation', into: 'conversation' },
    { key: 'new', icon: MessageSquarePlus, label: 'Start a new conversation', run: doing.onNewSession },
    {
      key: 'mode',
      icon: ShieldCheck,
      label: 'How much she asks first',
      note: MODES.find((mode) => mode.value === doing.mode)?.note,
      into: 'mode',
    },
    { key: 'log', icon: ScrollText, label: 'Open the backlog', run: doing.onOpenHistory },
    { key: 'compact', icon: Shrink, label: 'Compact the context', run: doing.onCompact },
    { key: 'usage', icon: Gauge, label: 'Plan usage', note: '/usage', run: () => doing.onOpenPanel('/usage') },
    { key: 'context', icon: Gauge, label: 'Context window', note: '/context', run: () => doing.onOpenPanel('/context') },
    { key: 'agents', icon: Users, label: 'Subagents', note: '/agents', run: () => doing.onOpenPanel('/agents') },
    { key: 'mcp', icon: Plug, label: 'MCP servers', note: '/mcp', run: () => doing.onOpenPanel('/mcp') },
    { key: 'status', icon: UserCog, label: 'Account and session', note: '/status', run: () => doing.onOpenPanel('/status') },
  ]

  const wanted = typed.trim().toLowerCase()
  const entries: Entry[] = (
    step === 'commands'
      ? commands
      : step === 'folder'
        ? [
            // First, because it is the one entry that always leads somewhere:
            // the list under it can only hold folders she has already been to.
            {
              key: 'browse',
              icon: FolderSearch,
              label: 'Somewhere not on this list…',
              run: () => void window.cafe?.openFolder().then((picked) => onClose(Boolean(picked))),
            } satisfies Entry,
            ...folders.map((path): Entry => ({
              key: `folder-${path}`,
              icon: FolderOpen,
              label: shorten(path),
              note: path === folder ? 'here' : undefined,
              here: path === folder,
              run: () => window.cafe?.switchFolder(path),
            })),
          ]
        : step === 'mode'
          ? MODES.map((mode): Entry => ({
              key: `mode-${mode.value}`,
              icon: ShieldCheck,
              label: mode.label,
              note: mode.value === doing.mode ? 'current' : mode.note,
              here: mode.value === doing.mode,
              run: () => doing.onMode(mode.value),
            }))
        : conversations.map((past): Entry => ({
            key: `past-${past.sessionId}`,
            icon: Clock,
            label: past.opening,
            note: past.sessionId === conversation ? 'here' : formatWhen(past.at),
            here: past.sessionId === conversation,
            run: () => window.cafe?.resume(past.sessionId),
          }))
  ).filter((entry) => entry.label.toLowerCase().includes(wanted) || (entry.note ?? '').includes(wanted))

  const at = Math.min(active, Math.max(entries.length - 1, 0))

  useEffect(() => {
    list.current?.children[at]?.scrollIntoView({ block: 'nearest' })
  }, [at])

  function choose(entry: Entry | undefined) {
    if (!entry || entry.here) return
    if (entry.into) {
      setStep(entry.into)
      setTyped('')
      setActive(0)
      return
    }
    entry.run?.()
    // Going somewhere replaces what is on screen; the rest only opens something
    // over it, and either way the bar has done its part.
    onClose(entry.key.startsWith('folder-') || entry.key.startsWith('past-'))
  }

  function back() {
    setStep('commands')
    setTyped('')
    setActive(0)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose(false)}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(520px,70vh)] w-[min(560px,88vw)] max-w-none flex-col gap-0 overflow-hidden border border-border bg-card/85 p-0 shadow-xl backdrop-blur-xl sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">What she can do</DialogTitle>
        <DialogDescription className="sr-only">
          Commands, and the folders and conversations they lead to.
        </DialogDescription>

        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          {step !== 'commands' && (
            // Where the master is inside the bar, and the way back out of it.
            <button
              type="button"
              onClick={back}
              className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {step === 'folder' ? 'Folder' : step === 'mode' ? 'Asking' : 'Conversation'}
              <ChevronRight className="size-3" />
            </button>
          )}
          <input
            autoFocus
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (!entries.length) return
                const step = event.key === 'ArrowDown' ? 1 : entries.length - 1
                setActive((current) => (Math.min(current, entries.length - 1) + step) % entries.length)
              }
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                choose(entries[at])
              }
              // Backing out of a list is the same key that backs out of what was
              // typed into it: once there is nothing left to delete, it is the
              // command itself that goes.
              if (event.key === 'Backspace' && !typed && step !== 'commands') {
                event.preventDefault()
                back()
              }
            }}
            placeholder={PROMPT[step]}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div ref={list} className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {entries.map((entry, index) => (
            <button
              key={entry.key}
              type="button"
              disabled={entry.here}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(entry)}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left disabled:cursor-default ${
                index === at && !entry.here ? 'bg-accent text-accent-foreground' : 'text-foreground'
              } ${entry.here ? 'text-muted-foreground' : ''}`}
            >
              <entry.icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">{entry.label}</span>
              {entry.note && (
                <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                  {entry.note}
                </span>
              )}
              {entry.into && <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />}
            </button>
          ))}
          {entries.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing by that name.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-[11px] text-muted-foreground">
          <span className="truncate">{shorten(folder)}</span>
          <span className="shrink-0">↑↓ move · ⏎ pick · esc close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const PROMPT = {
  commands: 'What should ことね do?',
  folder: 'Which folder?',
  conversation: 'Which conversation?',
  mode: 'How much should she ask first?',
}

/** The home part of the path says nothing worth the width. */
function shorten(path: string) {
  return path.replace(/^\/Users\/[^/]+/, '~')
}

/** Today by the clock, anything older by the date — the way anyone says it. */
function formatWhen(at: number) {
  const when = new Date(at)
  const today = new Date().toDateString() === when.toDateString()
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(today ? {} : { month: 'short', day: 'numeric' }),
  }).format(when)
}
