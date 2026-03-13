import type { Maid } from '../utils/maids.js'
import { renderMarkdown } from '../utils/markdown.js'

export function MaidPage({ maid }: { maid: Maid }) {
  const html = renderMarkdown(maid.rawMd)

  return (
    <div class="maid-page">
      <div class="maid-cta">
        <p>Add to your <code>CLAUDE.md</code> to make Claude this maid — <button type="button" id="hire-btn" data-md={maid.rawMd}>copy source</button></p>
      </div>
      <article class="maid-detail">
        <header class="maid-grid maid-header">
          <h1 class="maid-name">{maid.jaName}</h1>
          <span class="maid-traits">{maid.title}</span>
          <span class="maid-en-name">{maid.enName}</span>
          <p class="maid-quote">「{maid.quote}」</p>
        </header>
        <div class="maid-content" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      <script src="/assets/copy.js" defer />
    </div>
  )
}
