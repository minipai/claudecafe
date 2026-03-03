export const css = /* css */ `
:root {
  --bg: #faf6f0;
  --bg-card: #ffffff;
  --text: #3c2f2f;
  --text-muted: #7a6a5e;
  --border: #e8ddd0;
  --accent: #8b7355;
  --header-bg: #3c2f2f;
  --header-text: #faf6f0;
  --shadow: 0 2px 8px rgba(60, 47, 47, 0.08);
  --radius: 12px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: "Noto Serif TC", "Noto Serif JP", Georgia, "Times New Roman", serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.8;
  min-height: 100vh;
}

/* Header */
.site-header {
  background: var(--header-bg);
  color: var(--header-text);
}

.site-header-inner {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  max-width: 960px;
  margin: 0 auto;
}

.header-left {
  justify-self: start;
  display: flex;
}

.header-back {
  display: flex;
  align-items: center;
  color: var(--header-text);
  text-decoration: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Noto Sans JP", sans-serif;
  font-size: 0.85rem;
  opacity: 0.8;
  padding: 0.7rem 1.5rem;
}

.header-back:hover {
  opacity: 1;
}

.header-right {
  justify-self: end;
}

.site-logo {
  height: 1.2em;
  width: auto;
  filter: brightness(0) invert(1);
}

.site-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--header-text);
  text-decoration: none;
  font-size: 1.2rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  padding: 0.7rem 1.5rem;
}

/* Main */
main {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

/* Hero */
.hero {
  text-align: center;
  margin-bottom: 2.5rem;
}

.hero h1 {
  font-size: 2rem;
  color: var(--accent);
  margin-bottom: 0.5rem;
}

.hero p {
  color: var(--text-muted);
  font-size: 1.05rem;
}

/* Maid List */
.maid-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
}

.maid-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 0.5rem;
  text-decoration: none;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  transition: background 0.15s ease;
}

.maid-row:hover {
  background: var(--bg-card);
}

.maid-avatar {
  display: none;
}

.maid-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.maid-info-primary {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.maid-name {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--accent);
}

.maid-en-name {
  margin-left: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Noto Sans JP", sans-serif;
  font-size: 0.85rem;
  color: var(--text-muted);
  flex-shrink: 0;
  align-self: flex-start;
  opacity: 0.3;
  transition: opacity 0.15s ease;
}

.maid-row:hover .maid-en-name {
  opacity: 1;
}

.maid-traits {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.maid-quote {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-style: italic;
}

/* Role Detail Page */
.role-detail {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 2rem;
  box-shadow: 1px 2px 6px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02);
  position: relative;
}

.role-detail::before {
  content: '';
  display: block;
  position: absolute;
  border: 50px solid transparent;
  border-top: 50px solid var(--bg);
  top: -60px;
  left: -65px;
  box-shadow: 0 -7px 6px -9px rgba(0,0,0,0.5);
  transform: rotate(135deg);
}

.role-detail::after {
  content: '';
  display: block;
  position: absolute;
  border: 50px solid transparent;
  border-bottom: 50px solid var(--bg);
  bottom: -60px;
  right: -65px;
  box-shadow: 0 7px 6px -9px rgba(0,0,0,0.5);
  transform: rotate(135deg);
}

.role-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.role-header .maid-name {
  font-size: 1.5rem;
}

.role-illustration {
  display: none;
}

/* Markdown content */
.role-content { font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace; font-size: 0.9rem; line-height: 1.7; }
.role-content .md-hash { opacity: 0.3; }
.role-content h1 { font-size: 1.3rem; margin: 1.5rem 0 0.8rem; color: var(--maid-color, var(--accent)); }
.role-content h2 { font-size: 1.1rem; margin: 1.3rem 0 0.6rem; color: var(--maid-color, var(--accent)); }
.role-content p { margin-bottom: 0.8rem; }
.role-content ul, .role-content ol { margin: 0.5rem 0 1rem 0; list-style: none; }
.role-content li { margin-bottom: 0.3rem; }
.role-content code {
  background: var(--bg);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

/* Role Footer */
.role-footer {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Noto Sans JP", sans-serif;
  text-align: center;
  padding: 0;
}

.role-footer-note {
  margin-top: 1.5rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  opacity: 0.6;
}

.role-footer-note code {
  background: var(--border);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.75rem;
}

.role-footer-note a {
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
}

.role-footer-note a:hover {
  text-decoration: underline;
}

/* Site Footer */
.site-footer {
  text-align: center;
  padding: 2rem 1.5rem;
  font-size: 0.7rem;
}

.site-footer a {
  color: var(--text-muted);
  text-decoration: none;
  opacity: 0.4;
}

.site-footer a:hover {
  opacity: 0.8;
}

/* RWD */
@media (max-width: 600px) {
  .site-title { font-size: 1.4rem; }
  .hero h1 { font-size: 1.5rem; }
  main { padding: 1rem; }
  .role-detail { padding: 1.2rem; }
  .maid-grid { grid-template-columns: 1fr; }
  .header-back { font-size: 0; line-height: 0; padding: 0.7rem 1.2rem; min-width: 44px; min-height: 44px; justify-content: center; }
  .header-back::before { content: '←'; font-size: 1rem; line-height: normal; }
  .maid-info-primary { flex-direction: column; gap: 0.2rem; }
  .maid-en-name { display: none; }
  .role-detail { overflow: hidden; margin: -1rem; border: none; border-bottom: 1px solid var(--border); box-shadow: none; border-radius: 0; }
  .role-detail::before, .role-detail::after { display: none; }
}
`
