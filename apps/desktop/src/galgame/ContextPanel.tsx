import { CommandPanel, Figure, Heading, Meter, tokens, useAnswer } from './CommandPanel'
import type { ContextReport } from '@/agent'

type ContextPanelProps = {
  open: boolean
  onClose: () => void
}

/**
 * What is filling the context window, category by category. The same accounting
 * `/context` prints, except the shares are drawn instead of tabulated — and
 * measured now, not at the end of the last turn like the status line.
 */
export function ContextPanel({ open, onClose }: ContextPanelProps) {
  const { answer: report, ready } = useAnswer<ContextReport>(open, () => window.cafe!.context())

  return (
    <CommandPanel
      open={open}
      title="/context"
      description="What is filling the context window."
      ready={ready}
      missing={report ? undefined : 'The session could not report its context.'}
      onClose={onClose}
    >
      {report && (
        <>
          <section>
            <Meter
              label={report.model}
              percent={report.percentage}
              note={`${tokens(report.totalTokens)} / ${tokens(report.maxTokens)}`}
              caption={`${report.percentage}% of the window is in use`}
            />
          </section>

          <section className="flex flex-col gap-3">
            <Heading>Where it went</Heading>
            {report.categories.map((category) => (
              <Meter
                key={category.name}
                // Deferred means the tools are counted but loaded on demand, so
                // the row is not the same kind of full as the others.
                label={category.deferred ? `${category.name} · on demand` : category.name}
                percent={(category.tokens / report.maxTokens) * 100}
                note={tokens(category.tokens)}
              />
            ))}
          </section>

          {report.memoryFiles.length > 0 && (
            <section>
              <Heading>Memory files</Heading>
              <div className="flex flex-col gap-1.5">
                {report.memoryFiles.map((file) => (
                  <Figure key={file.path} label={shorten(file.path)} value={tokens(file.tokens)} />
                ))}
              </div>
            </section>
          )}

          {report.mcpTools.length > 0 && (
            <section>
              <Heading>MCP tools</Heading>
              <div className="flex flex-col gap-1.5">
                {report.mcpTools.map((tool) => (
                  <Figure
                    key={`${tool.server}-${tool.name}`}
                    label={`${tool.name} · ${tool.server}`}
                    value={tokens(tool.tokens)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </CommandPanel>
  )
}

/** Memory files are named by absolute path; the home part of it says nothing. */
function shorten(path: string) {
  return path.replace(/^\/Users\/[^/]+/, '~')
}
