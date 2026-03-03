import type { Child } from 'hono/jsx'
import { css } from '../styles/css.js'

export function Layout({ children, title, showBack }: { children: Child; title?: string; showBack?: boolean }) {
  const pageTitle = title ? `${title} — Claude Café` : 'Claude Café'
  return (
    <html lang="zh-Hant">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{pageTitle}</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <header class="site-header">
          <div class="site-header-inner">
            <div class="header-left">
              {showBack ? <a href="/" class="header-back">← 回到大廳</a> : <span />}
            </div>
            <a href="/" class="site-title">
              Claude Café
            </a>
            <div class="header-right" />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
