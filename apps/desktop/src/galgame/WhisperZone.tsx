import { AnimatePresence, motion } from 'motion/react'
import type { Whisper } from './types'
import { cn } from '@/lib/utils'

/**
 * Tool narration and stray thoughts, floating just above the dialogue box —
 * anchored to it, so they stay clear of it however tall it grows.
 */
export function WhisperZone({ whispers }: { whispers: Whisper[] }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-[5] mb-4 flex w-[min(560px,86vw)] -translate-x-1/2 flex-col items-center gap-1.5">
      <AnimatePresence>
        {whispers.map((w) => (
          <motion.div
            key={w.id}
            className={cn(
              'px-3.5 py-1 text-sm tracking-[.01em] text-muted-foreground shadow-sm',
              w.kind === 'thought'
                ? 'rounded-2xl border border-dashed border-border bg-card/80 italic'
                : 'rounded-full border border-border bg-card',
            )}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {w.kind === 'thought' ? `…${w.text}` : w.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
