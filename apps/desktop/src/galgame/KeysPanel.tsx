import { CommandPanel, Heading } from './CommandPanel'
import { text } from '@/i18n'

/**
 * The keys the window answers to, written down. Everything here works whether
 * it is read or not — this is the one place that says so, since a frameless
 * window has no menu bar to hang them off and nowhere on the scene to print
 * them without standing in front of her.
 */
export function KeysPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = text().panel.keys

  const groups = [
    { heading: t.scene, keys: [['Space', t.turn], ['esc', t.stop]] },
    { heading: t.panels, keys: [['⌘K', t.bar], ['⌘L', t.log], ['esc', t.close]] },
    {
      heading: t.composer,
      keys: [['⏎', t.send], ['⇧⏎', t.newline], ['/', t.slash], ['⌘V', t.paste]],
    },
  ]

  return (
    <CommandPanel open={open} title="/keys" description={t.description} ready onClose={onClose}>
      {groups.map((group) => (
        <section key={group.heading}>
          <Heading>{group.heading}</Heading>
          <div className="flex flex-col gap-2.5">
            {group.keys.map(([key, said]) => (
              <div key={`${group.heading}-${key}`} className="flex items-baseline gap-3">
                <kbd className="w-14 shrink-0 rounded border border-border bg-muted py-0.5 text-center font-mono text-[11px] text-muted-foreground">
                  {key}
                </kbd>
                <span className="text-sm text-foreground">{said}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </CommandPanel>
  )
}
