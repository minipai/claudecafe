import type { Role } from '../utils/roles.js'
import { MaidCard } from './MaidCard.js'

export function HomePage({ roles }: { roles: Role[] }) {
  return (
    <div class="home">
      <section class="hero">
        <h1>いらっしゃいませ</h1>
        <p>歡迎來到 The Claude Café，這裡有六位個性迥異的女僕為您服務。</p>
      </section>
      <div class="maid-list">
        {roles.map(role => (
          <MaidCard role={role} />
        ))}
      </div>
    </div>
  )
}
