import type { Child } from "hono/jsx";
import { href, ui, type Locale } from "../i18n.js";

const SITE_URL = "https://claudecafe.dev";
const DEFAULT_DESCRIPTION =
  "Give your Claude a maid persona. Browse, pick, and make it yours.";

export function Layout({
  children,
  locale = "en",
  title,
  description,
  path = "/",
  maid,
}: {
  children: Child;
  locale?: Locale;
  title?: string;
  description?: string;
  path?: string; // logical path, no locale prefix
  maid?: string;
}) {
  const pageTitle = title ? `${title} — The Claude Café` : "The Claude Café";
  const ogDescription = description || DEFAULT_DESCRIPTION;
  const segments = path?.replace(/\/$/, "").split("/").filter(Boolean) ?? [];
  const backHref = segments.length > 1 ? "/" + segments.slice(0, -1).join("/") : segments.length === 1 ? "/" : null;
  const backLabel = segments.length > 1 ? segments[segments.length - 2] : "café";
  const other: Locale = locale === "zh" ? "en" : "zh";
  return (
    <html lang={locale === "zh" ? "zh-Hant" : "en"}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{pageTitle}</title>
        <meta property="og:title" content={pageTitle} />
        <meta name="description" content={ogDescription} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:image" content={`${SITE_URL}/assets/og-image.png`} />
        <meta property="og:url" content={`${SITE_URL}${href(locale, path)}`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={`${SITE_URL}${href(locale, path)}`} />
        <link rel="alternate" hreflang="en" href={`${SITE_URL}${href("en", path)}`} />
        <link rel="alternate" hreflang="zh-Hant" href={`${SITE_URL}${href("zh", path)}`} />
        <link rel="alternate" hreflang="x-default" href={`${SITE_URL}${href("en", path)}`} />
        <link rel="icon" href="/assets/icons/favicon.ico" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/assets/icons/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/assets/icons/favicon-16x16.png"
        />
        <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />
        {/* maid bg images loaded by maid-bg.js */}
        <link rel="stylesheet" href="/assets/styles.css" />
      </head>
      <body {...(maid ? { 'data-maid': maid } : {})}>
        <header class="site-header">
          <div class="site-header-inner">
            <div class="header-left">
              {backHref ? (
                <a href={href(locale, backHref)} class="header-back">
                  ←&nbsp;<span class="header-back-text">{backLabel}</span>
                </a>
              ) : null}
            </div>
            <a href={href(locale, "/")} class="site-title">
              <img src="/assets/icons/bow.png" alt="" class="site-logo" />
              The Claude Café
            </a>
            <div class="header-right">
              {/* ?lang= sets the preference cookie, then redirects clean */}
              <a href={`${href(other, path)}?lang=${other}`} class="lang-switch" rel="nofollow">
                {ui[locale].switcherLabel}
              </a>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <script src="/assets/maid-bg.js" defer />
      </body>
    </html>
  );
}
