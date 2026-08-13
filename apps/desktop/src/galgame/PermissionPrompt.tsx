import { FileDiff, ListChecks, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { diffLines, type PermissionAsk } from './permission'
import { cn } from '@/lib/utils'

type PermissionPromptProps = {
  ask: PermissionAsk
  onAllow: () => void
  onAlwaysAllow: () => void
  onDeny: () => void
  onExpand: () => void
}

const ICON = {
  plan: ListChecks,
  edit: FileDiff,
  command: Terminal,
  generic: Terminal,
}

/** Additions and removals stay monochrome — weight and a marker carry the meaning. */
function Diff({ before, after }: { before: string; after: string }) {
  return (
    <pre className="max-h-40 overflow-auto font-mono text-xs leading-[1.7]">
      {diffLines(before, after).map((row, index) => (
        <div
          key={index}
          className={cn(
            'px-3 whitespace-pre',
            row.sign === '+' && 'bg-foreground/[0.07] font-medium text-foreground',
            row.sign === '-' && 'text-muted-foreground line-through decoration-muted-foreground/50',
            row.sign === ' ' && 'text-muted-foreground',
          )}
        >
          <span className="mr-2 inline-block w-2 opacity-60">{row.sign.trim()}</span>
          {row.text}
        </div>
      ))}
    </pre>
  )
}

/**
 * Takes over the demo-button slot while a tool call waits on an answer. The
 * card carries whatever the request is actually about — a command, a diff, or
 * a plan — so the choice is never made blind.
 */
export function PermissionPrompt({ ask, onAllow, onAlwaysAllow, onDeny, onExpand }: PermissionPromptProps) {
  const Icon = ICON[ask.kind]

  return (
    <div className="flex flex-col gap-2.5">
      <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate font-mono">{ask.title}</span>
          {ask.expand && (
            <Button
              variant="link"
              size="sm"
              className="ml-auto h-auto p-0 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={onExpand}
            >
              Read in full →
            </Button>
          )}
        </div>

        <div className="border-t border-border/70 bg-card/60 py-2">
          {ask.command && (
            <code className="block px-3 font-mono text-xs leading-[1.7] break-all text-foreground">
              $ {ask.command}
            </code>
          )}
          {ask.diff && <Diff before={ask.diff.before} after={ask.diff.after} />}
          {ask.planPreview && (
            <p className="line-clamp-2 px-3 text-xs leading-[1.7] text-muted-foreground">{ask.planPreview}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onAllow}>
          {ask.allowLabel}
        </Button>
        {ask.canAlwaysAllow && (
          <Button variant="outline" size="sm" onClick={onAlwaysAllow} title={`Every ${ask.standing} for the rest of this session`}>
            Always allow {ask.standing}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onDeny}>
          {ask.denyLabel}
        </Button>
      </div>
    </div>
  )
}
