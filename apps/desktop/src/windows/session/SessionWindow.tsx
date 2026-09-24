import { useEffect, useState } from 'react'
import { text } from '@/i18n'
import type { SceneShare, SessionTab } from '@/agent'
import { UsageTab } from './UsageTab'
import { ContextTab } from './ContextTab'
import { AgentsTab } from './AgentsTab'
import { McpTab } from './McpTab'
import { StatusTab } from './StatusTab'

const TABS: SessionTab[] = ['usage', 'context', 'agents', 'mcp', 'status']

/**
 * What the session is running on — the figures `/usage`, `/context`, `/agents`,
 * `/mcp` and `/status` print in a terminal, one tab each, beside her while she
 * works. Every tab asks the session again as it comes up: they are live
 * figures, and one from ten minutes ago is worse than one that takes a moment.
 */
export function SessionWindow({ session }: { session: SceneShare['session'] }) {
  const t = text()
  const [tab, setTab] = useState(session.tab)
  /** Bumped each time a tab is asked for, so asking again asks the session again. */
  const [asked, setAsked] = useState(0)

  // A slash command typed in the scene brings its own tab up, even when the
  // window was already open on another.
  useEffect(() => {
    setTab(session.tab)
    setAsked((count) => count + 1)
  }, [session.tab, session.asked])

  function show(next: SessionTab) {
    setTab(next)
    setAsked((count) => count + 1)
  }

  return (
    <main className="flex h-screen flex-col bg-card text-card-foreground">
      <nav className="flex gap-1 border-b border-border px-3 py-2" aria-label={t.session.title}>
        {TABS.map((each) => (
          <form
            key={each}
            onSubmit={(event) => {
              event.preventDefault()
              show(each)
            }}
          >
            <button
              type="submit"
              aria-pressed={each === tab}
              className={`rounded-md px-2.5 py-1 text-xs ${
                each === tab ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.bar[each]}
            </button>
          </form>
        ))}
      </nav>
      <TabBody key={`${tab}-${asked}`} tab={tab} />
    </main>
  )
}

function TabBody({ tab }: { tab: SessionTab }) {
  if (tab === 'usage') return <UsageTab />
  if (tab === 'context') return <ContextTab />
  if (tab === 'agents') return <AgentsTab />
  if (tab === 'mcp') return <McpTab />
  return <StatusTab />
}
