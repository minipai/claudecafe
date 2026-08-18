import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  Clock,
  FolderOpen,
  FolderSearch,
  Gauge,
  Languages,
  MessageCircle,
  MessageSquarePlus,
  PenLine,
  Plug,
  ScrollText,
  Search,
  ShieldCheck,
  Shrink,
  UserCog,
  Users,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CATALOGUES, fill, LOCALES, text } from '@/i18n'
import type { Conversation, SessionSettings } from '@/agent'

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
  /** Stays open after running — it changed what the bar itself is showing. */
  stay?: boolean
  /** Leads to a list of its own rather than doing something. */
  into?: 'folder' | 'conversation' | 'mode' | 'locale' | 'speech'
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

/** The usual answers, offered so the common case is one keystroke. Anything
 * typed instead is taken as it stands — she is told to reply in it, and a
 * sentence with an instruction in it works as well as a language's name. */
const SPOKEN = ['English', '繁體中文', '日本語', '简体中文', '한국어']

/** The permission modes, worded as the CLI words them, with what each one means
 * for the master standing there watching. */
const MODES: SessionSettings['mode'][] = ['default', 'auto', 'acceptEdits', 'plan']

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
  locale,
  speech,
  doing,
  onClose,
}: {
  open: boolean
  /** Where she is now, so the list can say so instead of offering it. */
  folder: string
  conversation: string | null
  /** Which language was picked for the interface — `system` included. */
  locale: string
  /** What she is speaking now, and what was picked for it — empty when the
   * window is leaving that to the café's own setting. */
  speech: { language: string; chosen: string }
  doing: Doing
  /** `moved` when she was sent somewhere — the scene starts over on it. */
  onClose: (moved: boolean) => void
}) {
  const t = text()
  /** The same words in English, matched against as well as the shown ones. */
  const eng = CATALOGUES.en
  // What the master picked, which may be `system` — in which case the note says
  // so rather than naming a language the window did not choose.
  const localeNote = locale === 'system' ? t.bar.system : LOCALES.find((one) => one.code === locale)?.label
  // Her language is a sentence, not a code, so the note is whatever it is set
  // to — trimmed to the first few words when the master has written an essay.
  const speechNote = speech.language.length > 24 ? `${speech.language.slice(0, 22)}…` : speech.language
  const [step, setStep] = useState<'commands' | 'folder' | 'conversation' | 'mode' | 'locale' | 'speech'>(
    'commands',
  )
  const [typed, setTyped] = useState('')
  /** In the language step, typing her language rather than picking one. */
  const [writing, setWriting] = useState(false)
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
    setWriting(false)
    void window.cafe?.folders().then(setFolders)
    void window.cafe?.conversations().then(setConversations)
  }, [open])

  const commands: Entry[] = [
    { key: 'folder', icon: FolderOpen, label: t.bar.folder, find: eng.bar.folder, note: shorten(folder), into: 'folder' },
    { key: 'resume', icon: Clock, label: t.bar.resume, find: eng.bar.resume, into: 'conversation' },
    { key: 'new', icon: MessageSquarePlus, label: t.bar.newSession, find: eng.bar.newSession, run: doing.onNewSession },
    { key: 'mode', icon: ShieldCheck, label: t.bar.mode, find: eng.bar.mode, note: t.mode.note[doing.mode], into: 'mode' },
    { key: 'log', icon: ScrollText, label: t.bar.log, find: eng.bar.log, note: '⌘L', run: doing.onOpenHistory },
    { key: 'compact', icon: Shrink, label: t.bar.compact, find: eng.bar.compact, run: doing.onCompact },
    { key: 'usage', icon: Gauge, label: t.bar.usage, find: eng.bar.usage, note: '/usage', run: () => doing.onOpenPanel('/usage') },
    { key: 'context', icon: Gauge, label: t.bar.context, find: eng.bar.context, note: '/context', run: () => doing.onOpenPanel('/context') },
    { key: 'agents', icon: Users, label: t.bar.agents, find: eng.bar.agents, note: '/agents', run: () => doing.onOpenPanel('/agents') },
    { key: 'mcp', icon: Plug, label: t.bar.mcp, find: eng.bar.mcp, note: '/mcp', run: () => doing.onOpenPanel('/mcp') },
    { key: 'status', icon: UserCog, label: t.bar.status, find: eng.bar.status, note: '/status', run: () => doing.onOpenPanel('/status') },
    { key: 'locale', icon: Languages, label: t.bar.locale, find: eng.bar.locale, note: localeNote, into: 'locale' },
    { key: 'speech', icon: MessageCircle, label: t.bar.speech, find: eng.bar.speech, note: speechNote, into: 'speech' },
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
              label: t.bar.browse,
              find: eng.bar.browse,
              // The native dialog answers on its own time — the bar waits for
              // it rather than closing itself and leaving the answer to land
              // out of band, with the reset it deserved already skipped.
              stay: true,
              run: () => void window.cafe?.openFolder().then((picked) => onClose(Boolean(picked))),
            } satisfies Entry,
            ...folders.map((path): Entry => ({
              key: `folder-${path}`,
              icon: FolderOpen,
              label: shorten(path),
              note: path === folder ? t.bar.here : undefined,
              here: path === folder,
              run: () => window.cafe?.switchFolder(path),
            })),
          ]
        : step === 'mode'
          ? MODES.map((mode): Entry => ({
              key: `mode-${mode}`,
              icon: ShieldCheck,
              label: t.mode[mode],
              find: eng.mode[mode],
              note: mode === doing.mode ? t.bar.current : t.mode.note[mode],
              here: mode === doing.mode,
              run: () => doing.onMode(mode),
            }))
        : step === 'speech'
          ? writing
            ? [
                // Her language is free text, so the whole list becomes the one
                // line being written: what is typed is the answer itself.
                {
                  key: 'speech-typed',
                  icon: PenLine,
                  label: typed.trim() ? fill(t.bar.speakThis, { said: typed.trim() }) : t.bar.speakHint,
                  here: !typed.trim(),
                  run: () => window.cafe?.setSpeech(typed.trim()),
                } satisfies Entry,
              ]
            : [
                // First, because it is the one that takes any answer at all —
                // the five under it are only the ones asked for most often.
                {
                  key: 'speech-write',
                  icon: PenLine,
                  label: t.bar.typeYourself,
                  find: eng.bar.typeYourself,
                  stay: true,
                  run: () => {
                    setWriting(true)
                    setTyped('')
                    setActive(0)
                  },
                } satisfies Entry,
                {
                  key: 'speech-cafe',
                  icon: MessageCircle,
                  label: t.bar.followCafe,
                  find: eng.bar.followCafe,
                  note: speech.chosen ? undefined : t.bar.current,
                  here: !speech.chosen,
                  run: () => window.cafe?.setSpeech(''),
                } satisfies Entry,
                ...SPOKEN.map((said): Entry => ({
                  key: `speech-${said}`,
                  icon: MessageCircle,
                  label: said,
                  note: said === speech.chosen ? t.bar.current : undefined,
                  here: said === speech.chosen,
                  run: () => window.cafe?.setSpeech(said),
                })),
              ]
        : step === 'locale'
          ? LOCALES.map((offered): Entry => ({
              key: `locale-${offered.code}`,
              icon: Languages,
              // The system entry says what following the system lands on, since
              // that is the one choice whose result is not its own name.
              label: offered.code === 'system' ? t.bar.system : offered.label,
              find: offered.code === 'system' ? eng.bar.system : offered.code,
              note: offered.code === locale ? t.bar.current : undefined,
              here: offered.code === locale,
              run: () => window.cafe?.setLocale(offered.code),
            }))
        : conversations.map((past): Entry => ({
            key: `past-${past.sessionId}`,
            icon: Clock,
            label: past.opening,
            note: past.sessionId === conversation ? t.bar.here : formatWhen(past.at),
            here: past.sessionId === conversation,
            run: () => window.cafe?.resume(past.sessionId),
          }))
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
    if (entry.stay) return
    // Going somewhere replaces what is on screen; the rest only opens something
    // over it, and either way the bar has done its part.
    onClose(entry.key.startsWith('folder-') || entry.key.startsWith('past-'))
  }

  function back() {
    setStep('commands')
    setTyped('')
    setActive(0)
    setWriting(false)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose(false)}>
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
                // Out of the writing line first, back to the list it came from.
                if (writing) setWriting(false)
                else back()
              }
            }}
            placeholder={t.bar.placeholder[step]}
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
