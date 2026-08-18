import { marked } from 'marked'
import { CommandPanel, useAnswer } from './CommandPanel'
import { text } from '@/i18n'
import { maidPersona } from '@/agent'

/**
 * Who she is, in her own file — the instructions the session was opened with,
 * which are what makes the window ことね rather than an assistant standing in
 * a maid's artwork. It hangs off her name plate because that is the thing on
 * the scene the question is actually about.
 *
 * Hard-wrapped prose, so single line breaks are left to close up the way
 * markdown means them to; the file is read, not spoken.
 */
export function PersonaPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = text().panel.persona
  const { answer: persona, ready } = useAnswer<string>(open, () => maidPersona())

  return (
    <CommandPanel
      open={open}
      title="ことね"
      description={t.description}
      ready={ready}
      missing={persona ? undefined : t.missing}
      onClose={onClose}
    >
      {persona && (
        <div
          className="report-md persona-md"
          dangerouslySetInnerHTML={{ __html: marked.parse(persona, { async: false }) }}
        />
      )}
    </CommandPanel>
  )
}
