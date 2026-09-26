import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { fill, text } from '@/i18n'
import { folderConversations, recentFolders, type Conversation } from '@/agent'
import { sendToScene } from '@/agent/windows'

/**
 * Where she has worked and what was said there: the folders on the left, the
 * conversations of the one picked on the right. Looking through them moves
 * nothing — only opening a conversation, or asking to work in a folder, sends
 * her there.
 */
export function ProjectsWindow({ folder, conversation }: { folder: string; conversation: string | null }) {
  const t = text().projects
  const [folders, setFolders] = useState<string[] | null>(null)
  const [picked, setPicked] = useState(folder)
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [folderQuery, setFolderQuery] = useState('')
  const [conversationQuery, setConversationQuery] = useState('')

  // Asked again whenever she moves: the folder she was just sent to belongs at
  // the top of the list, and it is the one worth looking into.
  useEffect(() => {
    setPicked(folder)
    void recentFolders().then((recent) => setFolders([folder, ...recent.filter((each) => each !== folder)]))
  }, [folder])

  useEffect(() => {
    let listening = true
    setConversations(null)
    setConversationQuery('')
    void folderConversations(picked).then((list) => {
      if (listening) setConversations(list)
    })
    return () => {
      listening = false
    }
  }, [picked, conversation])

  const shownFolders = (folders ?? []).filter((each) => each.toLowerCase().includes(folderQuery.trim().toLowerCase()))
  const shownConversations = (conversations ?? []).filter((each) =>
    each.opening.toLowerCase().includes(conversationQuery.trim().toLowerCase()),
  )

  return (
    <main className="grid h-screen grid-cols-[minmax(220px,2fr)_3fr] bg-card text-card-foreground">
      <section className="flex min-h-0 flex-col border-r border-border">
        <Header title={t.folders} note={folders ? counted(folders.length, t.oneFolder, t.folderCount) : ''} />
        <Filter value={folderQuery} onChange={setFolderQuery} placeholder={t.filterFolders} />
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {shownFolders.map((each) => (
            <li key={each}>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  setPicked(each)
                }}
              >
                <Row picked={each === picked} title={each}>
                  <span className="truncate text-sm">{nameOf(each)}</span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">{shorten(parentOf(each))}</span>
                  {each === folder && <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{text().bar.here}</span>}
                </Row>
              </form>
            </li>
          ))}
        </ul>
        <footer className="border-t border-border px-3 py-2.5">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              sendToScene({ kind: 'browse' })
            }}
          >
            <Button type="submit" size="sm" variant="outline">
              {t.browse}
            </Button>
          </form>
        </footer>
      </section>

      <section className="flex min-h-0 flex-col">
        <Header title={nameOf(picked) || t.conversations} note={conversations ? counted(conversations.length, t.oneConversation, t.conversationCount) : ''} />
        <Filter value={conversationQuery} onChange={setConversationQuery} placeholder={t.search} />
        {conversations?.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t.none}</p>}
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {shownConversations.map((each) => (
            <li key={each.sessionId}>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  sendToScene({ kind: 'conversation', folder: picked, sessionId: each.sessionId })
                }}
              >
                <Row picked={each.sessionId === conversation} title={each.opening}>
                  <span className="truncate text-sm">{each.opening}</span>
                  <time className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                    {each.sessionId === conversation ? text().bar.here : formatWhen(each.at)}
                  </time>
                </Row>
              </form>
            </li>
          ))}
        </ul>
        <footer className="flex justify-end border-t border-border px-3 py-2.5">
          {picked !== folder && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                sendToScene({ kind: 'folder', folder: picked })
              }}
            >
              <Button type="submit" size="sm">
                {t.workHere}
              </Button>
            </form>
          )}
        </footer>
      </section>
    </main>
  )
}

function Header({ title, note }: { title: string; note: string }) {
  return (
    <header className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-2">
      <h2 className="truncate text-sm font-medium">{title}</h2>
      <span className="shrink-0 text-[11px] text-muted-foreground">{note}</span>
    </header>
  )
}

function Filter({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="mx-3 mb-1 rounded-md border border-border bg-background px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
    />
  )
}

function Row({ picked, title, children }: { picked: boolean; title: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      title={title}
      aria-pressed={picked}
      className={`flex w-full items-baseline gap-2 px-4 py-1.5 text-left ${picked ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
    >
      {children}
    </button>
  )
}

function counted(count: number, one: string, many: string) {
  return count === 1 ? one : fill(many, { count })
}

function nameOf(folder: string) {
  return folder.slice(folder.lastIndexOf('/') + 1)
}

function parentOf(folder: string) {
  return folder.slice(0, folder.lastIndexOf('/') + 1)
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
