import { CommandPanel, Figure, Heading, Meter, useAnswer } from './CommandPanel'
import type { UsageReport } from '@/agent'

type UsagePanelProps = {
  open: boolean
  onClose: () => void
}

/**
 * What the plan has been spent on, drawn from the session's own figures rather
 * than from the text `/usage` prints — the printout is a flattened copy of
 * these, and a window can afford the bars the terminal draws.
 */
export function UsagePanel({ open, onClose }: UsagePanelProps) {
  const { answer: report, ready } = useAnswer<UsageReport>(open, () => window.cafe!.usage())

  return (
    <CommandPanel
      open={open}
      title="/usage"
      description="Plan limits and what this session has cost."
      ready={ready}
      missing={
        report ? undefined : 'This session has no plan limits to report — an API key is billed per request.'
      }
      onClose={onClose}
    >
      {report && (
        <>
          <section className="flex flex-col gap-4">
            {report.windows.map((window) => (
              <Meter
                key={window.label}
                label={window.label}
                percent={window.percent ?? 0}
                note={`${window.percent ?? 0}% used`}
                caption={window.resetsAt ? `Resets ${formatReset(window.resetsAt)}` : undefined}
              />
            ))}
            {report.windows.length === 0 && (
              <p className="text-sm text-muted-foreground">No plan windows reported.</p>
            )}
          </section>

          <section>
            <Heading>This session</Heading>
            <div className="flex flex-col gap-1.5">
              <Figure label="Cost" value={`US$${report.cost.toFixed(2)}`} />
              <Figure
                label="Code changed"
                value={`+${report.linesAdded.toLocaleString()} / −${report.linesRemoved.toLocaleString()} lines`}
              />
            </div>
          </section>

          {report.week && (
            <section>
              <Heading>
                Last 7 days · {report.week.requests.toLocaleString()} requests ·{' '}
                {report.week.sessions.toLocaleString()} sessions
              </Heading>
              {/* The CLI's own caveat, kept: this is scanned from the transcripts
                  on this machine, so other devices and claude.ai are missing. */}
              <p className="mb-3 text-xs text-muted-foreground">
                Counted from this machine's transcripts, and the shares overlap.
              </p>
              <div className="flex flex-col gap-1.5">
                {report.week.behaviours.map((behaviour) => (
                  <Figure key={behaviour.label} label={behaviour.label} value={`${behaviour.pct}%`} />
                ))}
                {report.week.skills.map((skill) => (
                  <Figure key={`skill-${skill.name}`} label={`/${skill.name}`} value={`${skill.pct}%`} />
                ))}
                {report.week.agents.map((agent) => (
                  <Figure key={`agent-${agent.name}`} label={agent.name} value={`${agent.pct}%`} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </CommandPanel>
  )
}

function formatReset(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
