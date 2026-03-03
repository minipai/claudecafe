import type { Role } from '../utils/roles.js'
import { renderMarkdown } from '../utils/markdown.js'

export function RolePage({ role }: { role: Role }) {
  const html = renderMarkdown(role.rawMd)

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
    </div>
  )
}
