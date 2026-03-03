import type { Role } from '../utils/roles.js'
import { renderMarkdown } from '../utils/markdown.js'

export function RolePage({ role }: { role: Role }) {
  const html = renderMarkdown(role.rawMd)
  const rawMdJson = JSON.stringify(role.rawMd)

  const copyScript = `
    document.getElementById('hire-btn').addEventListener('click', function(e) {
      e.preventDefault();
      var md = ${rawMdJson};
      navigator.clipboard.writeText(md).then(function() {
        var link = document.getElementById('hire-btn');
        link.textContent = 'copied!';
        setTimeout(function() { link.textContent = 'copy source'; }, 2000);
      });
    });
  `

  return (
    <div class="role-page">
      <article class="role-detail">
        <header class="role-header">
          <div class="maid-info">
            <div class="maid-info-primary">
              <h1 class="maid-name">{role.jaName}</h1>
              <span class="maid-traits">{role.title}</span>
            </div>
            <p class="maid-quote">「{role.quote}」</p>
          </div>
          <span class="maid-en-name">{role.enName}</span>
        </header>
        <div class="role-illustration" />
        <div class="role-content" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
      <footer class="role-footer">
        <p class="role-footer-note">
          Add to your <code>CLAUDE.md</code> to make Claude this maid — <a href="#" id="hire-btn">copy source</a>
        </p>
      </footer>
      <script dangerouslySetInnerHTML={{ __html: copyScript }} />
    </div>
  )
}
