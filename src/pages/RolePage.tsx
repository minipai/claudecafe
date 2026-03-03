import type { Maid } from '../utils/maids.js'
import { renderMarkdown } from '../utils/markdown.js'

export function RolePage({ maid }: { maid: Maid }) {
  const html = renderMarkdown(maid.rawMd)
  const rawMdJson = JSON.stringify(maid.rawMd)

  const copyScript = `
    document.getElementById('hire-btn').addEventListener('click', function(e) {
      e.preventDefault();
      var md = ${rawMdJson};
      navigator.clipboard.writeText(md).then(function() {
        var link = document.getElementById('hire-btn');
        link.textContent = 'copied, cool';
        setTimeout(function() { link.textContent = 'copy source'; }, 2000);
      });
    });
  `

  return (
    <div class="role-page">
      <div class="role-cta">
        <p>Add to your <code>CLAUDE.md</code> to make Claude this maid — <a href="#" id="hire-btn">copy source</a></p>
      </div>
      <article class="role-detail">
        <header class="role-header">
          <div class="maid-info">
            <div class="maid-info-primary">
              <h1 class="maid-name">{maid.jaName}</h1>
              <span class="maid-traits">{maid.title}</span>
            </div>
            <p class="maid-quote">「{maid.quote}」</p>
          </div>
          <span class="maid-en-name">{maid.enName}</span>
        </header>
        <div class="role-content" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      <script dangerouslySetInnerHTML={{ __html: copyScript }} />
    </div>
  )
}
