import type { Maid } from '../utils/maids.js'

export function MaidCard({ maid }: { maid: Maid }) {
  return (
    <a href={`/${maid.slug}`} class="maid-row">
      <div class="maid-info">
        <div class="maid-info-primary">
          <span class="maid-name">{maid.jaName}</span>
          <span class="maid-traits">{maid.title}</span>
        </div>
        <p class="maid-quote">「{maid.quote}」</p>
      </div>
      <span class="maid-en-name">{maid.enName}</span>
    </a>
  )
}
