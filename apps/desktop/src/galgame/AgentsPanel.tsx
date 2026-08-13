import { CommandPanel, useAnswer } from './CommandPanel'
import type { Subagent } from '@/agent'

/**
 * Who she can send out. The list is the session's own — the built-in agents
 * plus whatever this folder and the master's settings define — so it is a
 * roster of this project, not of the app.
 */
export function AgentsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { answer: agents, ready } = useAnswer<Subagent[]>(open, () => window.cafe!.agents())

  return (
    <CommandPanel
      open={open}
      title="/agents"
      description="The subagents this folder can call on."
      ready={ready}
      missing={agents?.length ? undefined : 'No subagents are configured here.'}
      onClose={onClose}
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
    </CommandPanel>
  )
}
