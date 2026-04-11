import type { BlogPost } from '../utils/blog.js'

export function BlogIndexPage({ posts }: { posts: BlogPost[] }) {
  return (
    <div class="blog-index">
      <p class="blog-index-title">咖啡廳的角落有一本筆記本，女僕們會在空閒時寫點什麼。</p>
      <div class="blog-index-list">
        {posts.map((post) => (
          <div class="blog-list">
            <div class="blog-row">
              <time class="blog-row-date">{post.date}</time>
              <a href={`/notes/${post.slug}`} class="blog-row-title">{post.title}</a>
              <span class="blog-row-author">{post.author}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
