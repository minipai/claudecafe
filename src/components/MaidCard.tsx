import type { Role } from '../utils/roles.js'

export function MaidCard({ role }: { role: Role }) {
  return (
    <a href={`/roles/${role.slug}`} class="maid-row">
      <div class="maid-info">
        <div class="maid-info-primary">
          <span class="maid-name">{role.jaName}</span>
          <span class="maid-traits">{role.title}</span>
        </div>
        <p class="maid-quote">「{role.quote}」</p>
      </div>
      <span class="maid-en-name">{role.enName}</span>
    </a>
  )
}
