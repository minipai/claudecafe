import type { Child } from "hono/jsx";

const SITE_URL = "https://claudecafe.dev";
const DEFAULT_DESCRIPTION =
  "Give your Claude a maid persona. Browse, pick, and make it yours.";

export function Layout({
  children,
  title,
  showBack,
}: {
  children: Child;
  title?: string;
  showBack?: boolean;
}) {
  const pageTitle = title ? `${title} — The Claude Café` : "The Claude Café";
  const ogDescription = DEFAULT_DESCRIPTION;
  return (
    <html lang="zh-Hant">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{pageTitle}</title>
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:image" content={`${SITE_URL}/public/og-image.png`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/public/favicon.ico" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/public/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/public/favicon-16x16.png"
        />
        <link rel="apple-touch-icon" href="/public/apple-touch-icon.png" />
        <link rel="stylesheet" href="/public/styles.css" />
      </head>
      <body>
        <header class="site-header">
          <div class="site-header-inner">
            <div class="header-left">
              {showBack ? (
                <a href="/" class="header-back">
                  ←&nbsp;<span class="header-back-text">café</span>
                </a>
              ) : (
                <span />
              )}
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
  );
}
