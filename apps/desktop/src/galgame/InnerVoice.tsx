import { useRef } from 'react'
import { MessageCircleDashed } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import type { Look } from '@/agent'

type InnerVoiceProps = {
  look: Look
  onRead: () => void
}

/**
 * Unread inner-thought indicator beside the name plate: hover shows the look
 * snapshot (scene + inner line) in a popover, and once it has been seen the
 * icon goes away until the next look arrives.
 */
export function InnerVoice({ look, onRead }: InnerVoiceProps) {
  const opened = useRef(false)

  return (
    <HoverCard
      openDelay={150}
      closeDelay={150}
      onOpenChange={(open) => {
        if (open) opened.current = true
        else if (opened.current) onRead()
      }}
    >
      <HoverCardTrigger
        className="pointer-events-auto text-muted-foreground hover:text-foreground"
        aria-label="Inner monologue"
        onClick={(e) => e.stopPropagation()}
      >
        <MessageCircleDashed className="size-4.5 animate-pulse" />
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-72">
        <p className="text-sm leading-relaxed text-muted-foreground italic">{look.scene}</p>
        <p className="mt-1.5 text-sm leading-relaxed">「{look.dialogue}」</p>
      </HoverCardContent>
    </HoverCard>
  )
}
