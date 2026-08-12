import { useState } from 'react'
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

const MODELS = ['Fable 5', 'Opus 5', 'Sonnet 5']
const MODES = ['auto', 'plan']
const EFFORTS = ['low', 'medium', 'high']

function SettingSubmenu({
  label,
  value,
  items,
  onPick,
  formatValue = (item) => item,
}: {
  label: string
  value: string
  items: string[]
  onPick: (item: string) => void
  formatValue?: (item: string) => string
}) {
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
            <DropdownMenuRadioItem key={item} value={item}>
              {formatValue(item)}
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
  items: string[]
  onPick: (item: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          aria-label={`Switch ${label}, currently ${value}`}
          title={`${label}：${value}`}
        >
          {value}
          <ChevronDown className="size-3 opacity-55" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={8} className="min-w-32">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={onPick}>
          {items.map((item) => (
            <DropdownMenuRadioItem key={item} value={item}>
              {item}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Dialogue-frame utility pill: backlog beside a compact session-settings menu. */
export function SessionPlaque({ onOpenHistory }: { onOpenHistory: () => void }) {
  const [model, setModel] = useState(MODELS[0])
  const [mode, setMode] = useState(MODES[0])
  const [effort, setEffort] = useState(EFFORTS[2])

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

      <VisibleSetting label="Model" value={model} items={MODELS} onPick={setModel} />
      <VisibleSetting label="Effort" value={effort} items={EFFORTS} onPick={setEffort} />

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
          <SettingSubmenu label="Mode" value={mode} items={MODES} onPick={setMode} />
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
