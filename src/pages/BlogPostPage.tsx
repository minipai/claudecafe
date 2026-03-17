import type { BlogPost } from '../utils/blog.js'
import { renderBlogMarkdown } from '../utils/markdown.js'
import { getMaid } from '../utils/maids.js'

export function BlogPostPage({ post }: { post: BlogPost }) {
  const html = renderBlogMarkdown(post.content)
  const maid = post.author ? getMaid(post.author) : undefined
  const authorName = maid?.jaName ?? post.author

  return (
    <div class="blog-page">
      <header class="blog-header">
        {maid && (
          <img class="blog-avatar" src={`/assets/maids/avatar-${maid.slug}.webp`} alt={maid.jaName} />
        )}
        <div>
          <p class="blog-header-meta">
            <time class="blog-header-date">{post.date}</time>
            {authorName && <span class="blog-header-author">{authorName}</span>}
          </p>
          <h1 class="blog-header-title">{post.title}</h1>
        </div>
      </header>
      <article class="blog-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
