import type { Expression } from './types'
import neutral from '../assets/kotone-neutral.webp'
import happy from '../assets/kotone-happy.webp'
import curious from '../assets/kotone-curious.webp'
import thinking from '../assets/kotone-thinking.webp'
import focused from '../assets/kotone-focused.webp'
import proud from '../assets/kotone-proud.webp'
import embarrassed from '../assets/kotone-embarrassed.webp'
import frustrated from '../assets/kotone-frustrated.webp'
import confused from '../assets/kotone-confused.webp'
import surprised from '../assets/kotone-surprised.webp'
import sad from '../assets/kotone-sad.webp'
import flirty from '../assets/kotone-flirty.webp'
import horny from '../assets/kotone-horny.webp'
import { cn } from '@/lib/utils'

const SPRITE: Record<Expression, string> = {
  neutral,
  happy,
  curious,
  thinking,
  focused,
  proud,
  embarrassed,
  frustrated,
  confused,
  surprised,
  sad,
  flirty,
  horny,
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
