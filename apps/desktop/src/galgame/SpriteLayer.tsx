import type { Expression } from './types'
import kotoneNeutral from '../assets/kotone-neutral.webp'
import kotoneFocused from '../assets/kotone-focused.webp'
import kotoneHappy from '../assets/kotone-happy.webp'
import { cn } from '@/lib/utils'

const SPRITE: Record<Expression, string> = {
  neutral: kotoneNeutral,
  focused: kotoneFocused,
  happy: kotoneHappy,
}

/**
 * Keep the complete sprite in the scene. In the regular view it sits lower so
 * the dialogue box covers the lower body; backlog view pulls the full figure
 * into the viewport. Both framings hang off the same bottom edge so the switch
 * slides instead of jumping. The image itself is never cropped or upscaled.
 */
export function SpriteLayer({ expression, fullBody = false }: { expression: Expression; fullBody?: boolean }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2',
        'transition-[width,bottom] duration-300 ease-out',
        fullBody
          ? 'w-[min(100vw,40vh,512px)]'
          : '-bottom-[460px] w-[min(100vw,512px)] max-sm:-bottom-[100px]',
      )}
    >
      <img
        src={SPRITE[expression]}
        alt="ことね"
        draggable={false}
        className="h-auto w-full select-none"
      />
    </div>
  )
}
