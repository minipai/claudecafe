import { ChevronDown, History, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type { ModelChoice, SessionSettings } from '@/agent'

/** The permission modes, worded as the CLI words them. */
const MODES: { value: SessionSettings['mode']; label: string }[] = [
  { value: 'default', label: 'default' },
  { value: 'auto', label: 'auto' },
  { value: 'acceptEdits', label: 'accept edits' },
  { value: 'plan', label: 'plan mode' },
]

/** Every level the SDK takes; a model that supports fewer narrows this. */
const EFFORTS: SessionSettings['effort'][] = ['low', 'medium', 'high', 'xhigh', 'max']

function SettingSubmenu({
  label,
  value,
  items,
  onPick,
}: {
  label: string
  value: string
  items: { value: string; label: string }[]
  onPick: (item: string) => void
}) {
  const formatValue = (item: string) => items.find((i) => i.value === item)?.label ?? item
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="[&>svg:last-child]:ml-1">
        <span>{label}</span>
        <span className="ml-auto max-w-24 truncate text-right text-xs text-muted-foreground">
          {formatValue(value)}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={value} onValueChange={onPick}>
          {items.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function VisibleSetting({
  label,
  value,
  items,
  onPick,
}: {
  label: string
  value: string
  items: { value: string; label: string }[]
  onPick: (item: string) => void
}) {
  const shown = items.find((item) => item.value === value)?.label ?? value
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          aria-label={`Switch ${label}, currently ${value}`}
          title={`${label}：${shown}`}
        >
          {shown}
          <ChevronDown className="size-3 opacity-55" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={8} className="min-w-32">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={onPick}>
          {items.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Dialogue-frame utility pill: backlog beside a compact session-settings menu.
 * Every choice in here is one the session actually takes — the models are the
 * ones the account can run, and picking one changes the session on the spot.
 */
export function SessionPlaque({
  onOpenHistory,
  settings,
  models,
  onChange,
}: {
  onOpenHistory: () => void
  settings: SessionSettings
  models: ModelChoice[]
  onChange: (patch: Partial<SessionSettings>) => void
}) {
  const current = models.find((model) => model.value === (settings.model ?? 'default'))
  const efforts = current?.efforts.length ? current.efforts : EFFORTS

  return (
    <ButtonGroup className="h-8">
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2.5 font-mono text-[11px] tracking-[0.08em] text-muted-foreground"
        aria-label="Open conversation history"
        title="Conversation history"
        onClick={onOpenHistory}
      >
        <History className="size-3.5" />
        LOG
      </Button>

      <VisibleSetting
        label="Model"
        value={settings.model ?? 'default'}
        items={models.map((model) => ({ value: model.value, label: model.label }))}
        onPick={(value) => onChange({ model: value === 'default' ? null : value })}
      />
      <VisibleSetting
        label="Effort"
        value={settings.effort}
        items={efforts.map((level) => ({ value: level as string, label: level as string }))}
        onPick={(value) => onChange({ effort: value as SessionSettings['effort'] })}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="h-8 w-8"
            aria-label="Open session settings"
            title="Session settings"
          >
            <Settings />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-64">
          <DropdownMenuLabel>Session settings</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <SettingSubmenu
            label="Mode"
            value={settings.mode}
            items={MODES}
            onPick={(value) => onChange({ mode: value as SessionSettings['mode'] })}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
