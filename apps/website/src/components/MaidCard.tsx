import type { Maid } from '../utils/maids.js'
import { href, type Locale } from '../i18n.js'

export function MaidCard({ maid, locale }: { maid: Maid; locale: Locale }) {
  return (
    <a href={href(locale, `/${maid.slug}`)} class="maid-grid maid-row" data-maid={maid.slug}>
      <span class="maid-name">{maid.jaName}</span>
      <span class="maid-traits">{maid.title}</span>
      <span class="maid-en-name">{maid.enName}</span>
      <p class="maid-quote">「{maid.quote}」</p>
    </a>
  )
}
