import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  FolderOpen,
  Gauge,
  MessageSquarePlus,
  Plug,
  ScrollText,
  Settings,
  Search,
  ShieldCheck,
  Shrink,
  UserCog,
  UserRoundPlus,
  Users,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CATALOGUES, fill, her, text } from '@/i18n'
import type { SessionSettings, SessionTab } from '@/agent'

/** One thing the window can do, or one place it can go. */
type Entry = {
  key: string
  icon: typeof FolderOpen
  label: string
  note?: string
  /** The English wording for the same thing. Typing `folder` has to find the
   * folder entry whatever language the window is drawn in — the shortcuts are
   * muscle memory, and muscle memory is not translated. */
  find?: string
  /** Leads to a list of its own rather than doing something. */
  into?: 'mode'
  run?: () => void
  /** Where she already is: shown to say so, not offered as somewhere to go. */
  here?: boolean
}

type Doing = {
  onNewSession: () => void
  onChooseMaid: () => void
  onOpenHistory: () => void
  onOpenProjects: () => void
  onOpenSettings: () => void
  onOpenSession: (tab: SessionTab) => void
  onCompact: () => void
  /** How much she asks before doing, and how it is changed. Null is handing
   * it back to the master's terminal rather than pinning one here. */
  mode: SessionSettings['mode']
  modePicked: boolean
  onMode: (mode: SessionSettings['mode'] | null) => void
}

/** The permission modes, worded as the CLI words them, with what each one means
 * for the master standing there watching. */
const MODES: SessionSettings['mode'][] = ['default', 'auto', 'acceptEdits', 'plan']

/**
 * ⌘K: what she can be asked to do that is not said out loud — start over, pick
 * how much she asks, open one of the windows beside her. Where she works and
 * what she said there is the projects window's, which has room to show both.
 */
export function CommandBar({
  open,
  folder,
  doing,
  onClose,
}: {
  open: boolean
  /** Where she is working, said along the bottom. */
  folder: string
  doing: Doing
  onClose: () => void
}) {
  const t = text()
  /** The same words in English, matched against as well as the shown ones. */
  const eng = CATALOGUES.en
  const [step, setStep] = useState<'commands' | 'mode'>('commands')
  const [typed, setTyped] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setStep('commands')
    setTyped('')
    setActive(0)
  }, [open])

  const session = (tab: SessionTab, icon: Entry['icon']): Entry => ({
    key: tab,
    icon,
    label: t.bar[tab],
    find: eng.bar[tab],
    note: `/${tab}`,
    run: () => doing.onOpenSession(tab),
  })

  const commands: Entry[] = [
    { key: 'projects', icon: FolderOpen, label: t.bar.projects, find: eng.bar.projects, note: '/resume', run: doing.onOpenProjects },
    { key: 'new', icon: MessageSquarePlus, label: t.bar.newSession, find: eng.bar.newSession, run: doing.onNewSession },
    { key: 'new-maid', icon: UserRoundPlus, label: t.bar.newMaid, find: eng.bar.newMaid, run: doing.onChooseMaid },
    { key: 'mode', icon: ShieldCheck, label: t.bar.mode, find: eng.bar.mode, note: t.mode.note[doing.mode], into: 'mode' },
    { key: 'log', icon: ScrollText, label: t.bar.log, find: eng.bar.log, note: '⌘L', run: doing.onOpenHistory },
    { key: 'compact', icon: Shrink, label: t.bar.compact, find: eng.bar.compact, run: doing.onCompact },
    session('usage', Gauge),
    session('context', Gauge),
    session('agents', Users),
    session('mcp', Plug),
    session('status', UserCog),
    { key: 'settings', icon: Settings, label: t.bar.settings, find: eng.bar.settings, note: '⌘,', run: doing.onOpenSettings },
  ]

  const wanted = typed.trim().toLowerCase()
  const entries: Entry[] = (
    step === 'commands'
      ? commands
      : [
          // Where a window nobody has touched stands, and the only way back
          // to it once a mode has been picked here.
          {
            key: 'mode-follow',
            icon: ShieldCheck,
            label: t.mode.follow,
            find: CATALOGUES.en.mode.follow,
            note: doing.modePicked ? undefined : t.bar.current,
            here: !doing.modePicked,
            run: () => doing.onMode(null),
          } as Entry,
          ...MODES.map((mode): Entry => ({
            key: `mode-${mode}`,
            icon: ShieldCheck,
            label: t.mode[mode],
            find: eng.mode[mode],
            note: doing.modePicked && mode === doing.mode ? t.bar.current : t.mode.note[mode],
            here: doing.modePicked && mode === doing.mode,
            run: () => doing.onMode(mode),
          })),
        ]
  ).filter((entry) =>
    [entry.label, entry.find, entry.note].some((said) => (said ?? '').toLowerCase().includes(wanted)),
  )

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
    onClose()
  }

  function back() {
    setStep('commands')
    setTyped('')
    setActive(0)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(520px,70vh)] w-[min(560px,88vw)] max-w-none flex-col gap-0 overflow-hidden border border-border bg-card/85 p-0 shadow-xl backdrop-blur-xl sm:max-w-[560px]"
      >
        <DialogTitle className="sr-only">{t.bar.title}</DialogTitle>
        <DialogDescription className="sr-only">{t.bar.description}</DialogDescription>

        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          {step !== 'commands' && (
            // Where the master is inside the bar, and the way back out of it.
            <button
              type="button"
              onClick={back}
              className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t.bar.step[step]}
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
            placeholder={fill(t.bar.placeholder[step], { her: her() })}
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
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t.bar.empty}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 font-mono text-[11px] text-muted-foreground">
          <span className="truncate">{shorten(folder)}</span>
          <span className="shrink-0">{t.bar.hint}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The home part of the path says nothing worth the width. */
function shorten(path: string) {
  return path.replace(/^\/Users\/[^/]+/, '~')
}
