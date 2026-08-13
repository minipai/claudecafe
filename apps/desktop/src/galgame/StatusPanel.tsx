import { CommandPanel, Figure, Heading, useAnswer } from './CommandPanel'
import type { StatusReport } from '@/agent'

/**
 * Who she is signed in as and what this window was given to work with. Every
 * line is something the session reported; nothing here is the window's own
 * guess about itself.
 */
export function StatusPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { answer: status, ready } = useAnswer<StatusReport>(open, () => window.cafe!.status())

  return (
    <CommandPanel
      open={open}
      title="/status"
      description="The account and the session this window runs on."
      ready={ready}
      missing={status ? undefined : 'The session could not report its status.'}
      onClose={onClose}
    >
      {status && (
        <>
          <section>
            <Heading>Account</Heading>
            <div className="flex flex-col gap-1.5">
              {status.account.email && <Figure label="Signed in as" value={status.account.email} />}
              {status.account.organization && (
                <Figure label="Organization" value={status.account.organization} />
              )}
              {status.account.plan && <Figure label="Plan" value={status.account.plan} />}
              {status.account.provider && <Figure label="API" value={status.account.provider} />}
            </div>
          </section>

          <section>
            <Heading>This window</Heading>
            <div className="flex flex-col gap-1.5">
              {/* The folder is the one thing about this window that cannot be
                  changed from inside it — it was chosen when she was opened. */}
              <Figure label="Folder" value={shorten(status.cwd)} />
              <Figure label="Output style" value={status.outputStyle} />
            </div>
          </section>

          <section>
            <Heading>What she has to work with</Heading>
            <div className="flex flex-col gap-1.5">
              <Figure label="Slash commands" value={String(status.commands)} />
              <Figure label="Subagents" value={String(status.agents)} />
              <Figure label="MCP servers connected" value={String(status.mcpServers)} />
            </div>
          </section>
        </>
      )}
    </CommandPanel>
  )
}

/** The home part of the path says nothing worth the width. */
function shorten(path: string) {
  return path.replace(/^\/Users\/[^/]+/, '~')
}
