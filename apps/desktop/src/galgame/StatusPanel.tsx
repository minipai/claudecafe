import { CommandPanel, Figure, Heading, useAnswer } from './CommandPanel'
import { text } from '@/i18n'
import type { StatusReport } from '@/agent'

/**
 * Who she is signed in as and what this window was given to work with. Every
 * line is something the session reported; nothing here is the window's own
 * guess about itself.
 */
export function StatusPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = text().panel.status
  const { answer: status, ready } = useAnswer<StatusReport>(open, () => window.cafe!.status())

  return (
    <CommandPanel
      open={open}
      title="/status"
      description={t.description}
      ready={ready}
      missing={status ? undefined : t.missing}
      onClose={onClose}
    >
      {status && (
        <>
          <section>
            <Heading>{t.account}</Heading>
            <div className="flex flex-col gap-1.5">
              {status.account.email && <Figure label={t.signedInAs} value={status.account.email} />}
              {status.account.organization && (
                <Figure label={t.organization} value={status.account.organization} />
              )}
              {status.account.plan && <Figure label={t.plan} value={status.account.plan} />}
              {status.account.provider && <Figure label={t.api} value={status.account.provider} />}
            </div>
          </section>

          <section>
            <Heading>{t.window}</Heading>
            <div className="flex flex-col gap-1.5">
              {/* The folder is the one thing about this window that cannot be
                  changed from inside it — it was chosen when she was opened. */}
              <Figure label={t.folder} value={shorten(status.cwd)} />
              <Figure label={t.outputStyle} value={status.outputStyle} />
            </div>
          </section>

          <section>
            <Heading>{t.toWorkWith}</Heading>
            <div className="flex flex-col gap-1.5">
              <Figure label={t.commands} value={String(status.commands)} />
              <Figure label={t.agents} value={String(status.agents)} />
              <Figure label={t.mcpServers} value={String(status.mcpServers)} />
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
