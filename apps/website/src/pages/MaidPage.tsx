import type { Maid } from '../utils/maids.js'
import { renderMarkdown } from '../utils/markdown.js'
import { href, type Locale } from '../i18n.js'

export function MaidPage({ maid, locale }: { maid: Maid; locale: Locale }) {
  const html = renderMarkdown(maid.rawMd)
  const mdHref = href(locale, `/${maid.slug}.md`)

  return (
    <div class="maid-page">
      <div class="maid-cta">
        <p>Link from your <code>CLAUDE.md</code> to make Claude this maid — <a href={mdHref} download={`${maid.slug}.md`}>download</a></p>
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
    </div>
  )
}
