import type { BlogPost } from '../utils/blog.js'
import { getMaid } from '../utils/maids.js'
import { href, ui, type Locale } from '../i18n.js'

export function BlogIndexPage({ posts, locale }: { posts: BlogPost[]; locale: Locale }) {
  return (
    <div class="blog-index">
      <p class="blog-index-title">{ui[locale].blogIndexLead}</p>
      <div class="blog-index-list">
        {posts.map((post) => {
          const maid = post.author ? getMaid(post.author) : undefined
          return (
            <div
              class="blog-list"
              style={maid ? `--blog-avatar: url(/assets/maids/avatar-${maid.slug}.webp)` : undefined}
            >
              <a href={href(locale, `/notes/${post.slug}`)} class="blog-row">
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
