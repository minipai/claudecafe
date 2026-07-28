import type { Maid } from "../utils/maids.js";
import type { BlogPost } from "../utils/blog.js";
import { MaidCard } from "./MaidCard.js";

export function HomePage({ maids, posts }: { maids: Maid[]; posts: BlogPost[] }) {
  return (
    <div class="home">
      <section class="hero">
        <h1>いらっしゃいませ</h1>
        <p>歡迎來到 The Claude Café，這裡有五位個性鮮明的女僕為您服務。</p>
      </section>
      <div class="maid-list">
        {maids.map((maid) => (
          <MaidCard maid={maid} />
        ))}
      </div>
      {posts.length > 0 && (
        <div class="blog-list">
          <div class="blog-row">
            <time class="blog-row-date">{posts[0].date}</time>
            <a href={`/notes/${posts[0].slug}`} class="blog-row-title">{posts[0].title}</a>
            <a href="/notes" class="blog-row-action">Café Note →</a>
          </div>
        </div>
      )}
      <footer class="site-footer">
        <a
          href="https://www.flaticon.com/free-icon/bow_12575123"
          title="bow icons"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ribbon icon by Nur syifa fauziah
        </a>
      </footer>
    </div>
  );
}
