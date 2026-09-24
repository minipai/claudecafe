import { PanelBody, useAnswer } from '@/galgame/CommandPanel'
import { text } from '@/i18n'
import { subagents } from '@/agent'
import type { Subagent } from '@/agent'

/**
 * Who she can send out. The list is the session's own — the built-in agents
 * plus whatever this folder and the master's settings define — so it is a
 * roster of this project, not of the app.
 */
export function AgentsTab() {
  const t = text().panel.agents
  const { answer: agents, ready } = useAnswer<Subagent[]>(true, () => subagents())

  return (
    <PanelBody
      description={t.description}
      ready={ready}
      missing={agents?.length ? undefined : t.missing}
    >
      <section className="flex flex-col gap-4">
        {agents?.map((agent) => (
          <article key={agent.name}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm text-foreground">{agent.name}</h3>
              {agent.model && (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{agent.model}</span>
              )}
            </div>
            {/* The description is written for the model to match on, and runs
                long; two lines is enough to recognise it by. */}
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {agent.description}
            </p>
          </article>
        ))}
      </section>
    </PanelBody>
  )
}
