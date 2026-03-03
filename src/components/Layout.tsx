import type { Child } from 'hono/jsx'
import { css } from '../styles/css.js'

export function Layout({ children, title, showBack }: { children: Child; title?: string; showBack?: boolean }) {
  const pageTitle = title ? `${title} — The Claude Café` : 'The Claude Café'
  return (
    <html lang="zh-Hant">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{pageTitle}</title>
        <link rel="icon" href="/public/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/public/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/public/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/public/apple-touch-icon.png" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <header class="site-header">
          <div class="site-header-inner">
            <div class="header-left">
              {showBack ? <a href="/" class="header-back">← 回到大廳</a> : <span />}
            </div>
            <a href="/" class="site-title">
              <img src="/public/bow.png" alt="" class="site-logo" />
              The Claude Café
            </a>
            <div class="header-right" />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
