import type { Maid } from '../utils/maids.js'

export function MaidCard({ maid }: { maid: Maid }) {
  return (
    <a href={`/${maid.slug}`} class="maid-grid maid-row">
      <span class="maid-name">{maid.jaName}</span>
      <span class="maid-traits">{maid.title}</span>
      <span class="maid-en-name">{maid.enName}</span>
      <p class="maid-quote">「{maid.quote}」</p>
    </a>
  )
}
