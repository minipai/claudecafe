import { Heading } from '@/galgame/panels/CommandPanel'
import { text } from '@/i18n'
import { WINDOW_KEYS } from '@/agent/windowKeys'

/**
 * The keys the scene answers to, written down. Everything here works whether
 * it is read or not — this is the one place that says so, since a frameless
 * window has no menu bar to hang them off and nowhere on the scene to print
 * them without standing in front of her.
 */
export function Keys() {
  const t = text().panel.keys
  const labels = {
    log: t.log,
    reply: text().reply.title,
    projects: text().bar.projects,
    models: text().scene.model,
    usage: text().bar.usage,
    settings: t.settings,
  }

  const groups = [
    { heading: t.scene, keys: [['← / →', t.turn], ['⌘[ / ⌘]', t.turnKeys], ['Space', text().scene.readNextMessage], ['esc', t.stop]] },
    { heading: t.panels, keys: [
      ...WINDOW_KEYS.map(({ display, window }) => [display, window === null ? t.main : labels[window]]),
      ['⌘W', t.closeWindow],
      ['esc', t.close],
    ] },
    {
      heading: t.composer,
      keys: [['⏎', t.send], ['⇧⏎', t.newline], ['/', t.slash], ['⌘V', t.paste]],
    },
  ]

  return (
    <div className="flex flex-col gap-5">
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
    </div>
  )
}
