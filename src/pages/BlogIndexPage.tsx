import type { BlogPost } from '../utils/blog.js'
import { getMaid } from '../utils/maids.js'

export function BlogIndexPage({ posts }: { posts: BlogPost[] }) {
  return (
    <div class="blog-index">
      <p class="blog-index-title">咖啡廳的角落有一本筆記本，女僕們會在空閒時寫點什麼。</p>
      <div class="blog-index-list">
        {posts.map((post) => {
          const maid = post.author ? getMaid(post.author) : undefined
          return (
            <div
              class="blog-list"
              style={maid ? `--blog-avatar: url(/assets/maids/avatar-${maid.slug}.webp)` : undefined}
            >
              <a href={`/notes/${post.slug}`} class="blog-row">
                <time class="blog-row-date">{post.date}</time>
                <span class="blog-row-title">{post.title}</span>
                <span class="blog-row-author">{maid?.jaName ?? post.author ?? ''}</span>
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
