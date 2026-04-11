import type { BlogPost } from '../utils/blog.js'
import { renderBlogMarkdown } from '../utils/markdown.js'

export function BlogPostPage({ post }: { post: BlogPost }) {
  const html = renderBlogMarkdown(post.content)

  return (
    <div class="blog-page">
      <header class="blog-header">
        <p class="blog-header-meta">
          <time class="blog-header-date">{post.date}</time>
          {post.author && <span class="blog-header-author">{post.author}</span>}
        </p>
        <h1 class="blog-header-title">{post.title}</h1>
      </header>
      <article class="blog-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
