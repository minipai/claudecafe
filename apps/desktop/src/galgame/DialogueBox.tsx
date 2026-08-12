import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { NamePlate } from './NamePlate'
import { InnerVoice } from './InnerVoice'
import type { Look } from '@/agent'
import type { Expression } from './types'
import { cn } from '@/lib/utils'

type DialogueBoxProps = {
  expression: Expression
  line: string
  isTyping: boolean
  isLoading: boolean
  showAdvanceTri: boolean
  showMedium: boolean
  mediumContent: ReactNode
  ctaVisible: boolean
  isClickable: boolean
  onOpenReport: () => void
  onClick: () => void
  footer: ReactNode
  utility: ReactNode
  unreadLook: Look | null
  onLookRead: () => void
}

/**
 * The galgame dialogue panel — one frame holding the spoken line on top and
 * the demo/input footer below a divider. Short-tier replies just type into
 * it in place, and it grows/shrinks in place for the medium tier. It shares
 * a layoutId with ReportView so Motion morphs it into the big report panel
 * for the heavy tier instead of it being a separate transition.
 */
export function DialogueBox({
  expression,
  line,
  isTyping,
  isLoading,
  showAdvanceTri,
  showMedium,
  mediumContent,
  ctaVisible,
  isClickable,
  onOpenReport,
  onClick,
  footer,
  utility,
  unreadLook,
  onLookRead,
}: DialogueBoxProps) {
  return (
    <motion.div
      layout
      layoutId="dialogue-frame"
      transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
      className="relative w-full rounded-xl border border-border bg-card shadow-md"
    >
      <div className="absolute -top-4 left-6 z-10 flex items-center gap-2.5">
        <NamePlate expression={expression} isLoading={isLoading} />
        {unreadLook && <InnerVoice look={unreadLook} onRead={onLookRead} />}
      </div>
      <div className="absolute -top-4 right-4 z-10">{utility}</div>

      <motion.div
        layout
        className={cn('relative overflow-hidden px-6.5 pt-7 pb-4', isClickable && 'cursor-pointer')}
        onClick={onClick}
      >
        {showMedium ? (
          <div className="text-base leading-[1.9] text-foreground">{mediumContent}</div>
        ) : (
          <div className="relative">
            <div className="min-h-[2.2em] text-lg leading-[1.8] text-foreground">
              {line}
              {isTyping && (
                <span className="ml-0.5 inline-block h-[1em] w-0.5 -translate-y-0.5 animate-[caret-blink_1s_step-end_infinite] bg-foreground align-middle" />
              )}
            </div>
            <div
              className={cn(
                'absolute right-1 bottom-2 h-0 w-0 border-t-[9px] border-r-[7px] border-l-[7px] border-t-foreground border-r-transparent border-l-transparent opacity-0',
                showAdvanceTri && !isLoading && 'animate-[tri-blink_1.1s_ease-in-out_infinite] opacity-100',
              )}
            />
          </div>
        )}

        {ctaVisible && (
          <div className="mt-3 flex gap-2.5">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onOpenReport()
              }}
            >
              View full report →
            </Button>
          </div>
        )}
      </motion.div>

      <motion.div layout className="flex flex-col gap-2 border-t border-border px-4 pt-3 pb-3">
        {footer}
      </motion.div>
    </motion.div>
  )
}
