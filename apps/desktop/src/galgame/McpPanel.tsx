import { CommandPanel, useAnswer } from './CommandPanel'
import type { McpServer } from '@/agent'

/** A server that did not answer is the thing worth seeing, so it is coloured;
 * the rest stay quiet. */
const TONE: Record<McpServer['status'], string> = {
  connected: 'text-muted-foreground',
  pending: 'text-muted-foreground',
  disabled: 'text-muted-foreground',
  failed: 'text-destructive',
  'needs-auth': 'text-destructive',
}

/**
 * The MCP servers this session was given and whether they answered. The
 * connection belongs to the session, so this is the only place that can say —
 * and a server that failed is why a tool she reached for was not there.
 */
export function McpPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { answer: servers, ready } = useAnswer<McpServer[]>(open, () => window.cafe!.mcpServers())

  return (
    <CommandPanel
      open={open}
      title="/mcp"
      description="MCP servers and whether they answered."
      ready={ready}
      missing={servers?.length ? undefined : 'No MCP servers are configured here.'}
      onClose={onClose}
    >
      <section className="flex flex-col gap-3.5">
        {servers?.map((server) => (
          <article key={server.name}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="truncate text-sm text-foreground">{server.name}</h3>
              <span className={`shrink-0 font-mono text-xs ${TONE[server.status]}`}>{server.status}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {server.tools} {server.tools === 1 ? 'tool' : 'tools'}
              {server.scope && ` · ${server.scope}`}
            </p>
            {server.error && <p className="mt-0.5 text-xs text-destructive">{server.error}</p>}
          </article>
        ))}
      </section>
    </CommandPanel>
  )
}
