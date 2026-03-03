import type { Maid } from '../utils/maids.js'
import { MaidCard } from './MaidCard.js'

export function HomePage({ maids }: { maids: Maid[] }) {
  return (
    <div class="home">
      <section class="hero">
        <h1>いらっしゃいませ</h1>
        <p>歡迎來到 The Claude Café，這裡有六位個性迥異的女僕為您服務。</p>
      </section>
      <div class="maid-list">
        {maids.map(maid => (
          <MaidCard maid={maid} />
        ))}
      </div>
      <footer class="site-footer">
        <a href="https://www.flaticon.com/free-icon/bow_12575123" title="bow icons" target="_blank" rel="noopener noreferrer">Ribbon icons created by Nur syifa fauziah - Flaticon</a>
      </footer>
    </div>
  )
}
