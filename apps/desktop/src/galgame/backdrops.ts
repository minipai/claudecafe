import artNouveau from '../assets/backdrops/art-nouveau.webp'
import ukiyoE from '../assets/backdrops/ukiyo-e.webp'
import shojoManga from '../assets/backdrops/shojo-manga.webp'
import type { Backdrop } from '@/agent'

export const BACKDROPS: readonly Backdrop[] = ['none', 'art-nouveau', 'ukiyo-e', 'shojo-manga']

export function backdropSrc(backdrop: Backdrop): string | null {
  const pictures = {
    'art-nouveau': artNouveau,
    'ukiyo-e': ukiyoE,
    'shojo-manga': shojoManga,
  }
  return backdrop === 'none' ? null : pictures[backdrop]
}
