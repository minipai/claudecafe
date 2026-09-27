import type { Maid } from '../utils/maids.js'
import { renderMarkdown } from '../utils/markdown.js'
import { href, type Locale } from '../i18n.js'

export function MaidPage({ maid, locale }: { maid: Maid; locale: Locale }) {
  const html = withPortrait(renderMarkdown(maid.rawMd), maid.slug)
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
      <script src="/assets/maid-stand.js" defer />
    </div>
  )
}

// She is a book illustration floated beside the Vibe section, the first h2,
// so the text wraps around her; maid-stand.js lowers her onto the paper's
// bottom edge.
function withPortrait(html: string, slug: string): string {
  const src = `/assets/maids/portrait-${slug}.webp`
  const img = `<img class="maid-stand" src="${src}" style="shape-outside: url(${src})" alt="">`
  const at = html.indexOf('<h2>')
  return html.slice(0, at) + img + html.slice(at)
}
