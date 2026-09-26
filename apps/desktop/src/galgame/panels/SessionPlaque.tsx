import { Button } from '@/components/ui/button'
import { fill, text } from '@/i18n'
import { openSideWindow } from '@/agent/windows'

import type { ModelChoice, SessionSettings } from '@/agent'

export function SessionPlaque({
  settings,
  models,
}: {
  settings: SessionSettings
  models: ModelChoice[]
}) {
  const t = text().scene
  const current = models.find((model) => model.value === (settings.model ?? 'default'))

  return (
    <form onSubmit={(event) => { event.preventDefault(); openSideWindow('models') }}>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        className="h-[38px] max-w-48 truncate rounded-r-full rounded-l-none border border-border bg-card/95 pr-3 pl-5 text-xs text-foreground shadow-sm"
        aria-label={`${t.model}: ${current?.label ?? t.model}; ${t.effort}: ${settings.effort}`}
        title={`${current?.label ?? t.model} · ${settings.effort}`}
      >
        <span className="truncate">{current?.label ?? t.model} · {settings.effort}</span>
      </Button>
    </form>
  )
}

export function PermissionMode({
  settings,
  onChange,
}: {
  settings: SessionSettings
  onChange: (patch: Partial<SessionSettings>) => void
}) {
  const modes = ['default', 'acceptEdits', 'plan', 'auto'] as const
  const labels: Record<SessionSettings['mode'], string> = {
    default: 'manual mode',
    acceptEdits: 'accept edits',
    plan: 'plan mode',
    auto: 'auto mode',
    bypassPermissions: 'bypass permissions',
    dontAsk: "don't ask",
  }
  const currentIndex = modes.indexOf(settings.mode as (typeof modes)[number])
  const next = modes[currentIndex < 0 ? 0 : (currentIndex + 1) % modes.length]
  const label = text().bar.mode

  return (
    <form onSubmit={(event) => { event.preventDefault(); onChange({ mode: next, modePicked: true }) }}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="h-9 rounded-full px-3 text-xs"
        aria-label={fill(text().scene.switchSetting, { what: label, value: labels[settings.mode] })}
        title={`${label}: ${labels[settings.mode]}; click to switch to ${labels[next]}`}
      >
        {labels[settings.mode]}
      </Button>
    </form>
  )
}
