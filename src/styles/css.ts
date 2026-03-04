export const css = /* css */ `
:root {
  --bg: #faf6f0;
  --bg-card: #ffffff;
  --text: #3c2f2f;
  --text-muted: #7a6a5e;
  --border: #e8ddd0;
  --accent: #8b7355;
  --accent-bold: #8b2020;
  --header-bg: #3c2f2f;
  --header-text: #faf6f0;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Noto Sans JP", sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: "Noto Serif TC", "Noto Serif JP", Georgia, "Times New Roman", serif;
  background: var(--bg) url('/public/maid-bg.png') no-repeat -180px -80px / auto 1800px;
  color: var(--text);
  line-height: 1.8;
  min-height: 100vh;
  position: relative;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  background: rgba(250, 246, 240, 0.6);
  pointer-events: none;
  z-index: 0;
}

body > * {
  position: relative;
  z-index: 1;
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
  font-family: var(--font-sans);
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
  padding: 2rem 10px;
}

/* Hero */
.hero {
  text-align: center;
  margin: 0 auto;
  background: rgba(250, 246, 240, 0.85);
  padding: 3rem;
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
  background: rgba(250, 246, 240, 0.85);
}

.maid-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 0.5rem;
  text-decoration: none;
  color: var(--text);
  border-bottom: 1px dashed var(--border);
}

.maid-row:first-child {
  border-top: 1px dashed var(--border);
}

.maid-row:hover .maid-info {
  transform: translateX(5px);
}

.maid-info {
  transition: transform 0.25s ease;
}

.maid-row:hover {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5) 5%, rgba(255, 255, 255, 0.5) 60%, transparent);
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
  font-family: var(--font-sans);
  font-size: 0.85rem;
  color: var(--text-muted);
  flex-shrink: 0;
  align-self: flex-start;
  opacity: 0.3;
  transition: opacity 0.15s ease;
}

.maid-row:hover .maid-name {
  color: var(--accent-bold);
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

/* Maid Detail */
.maid-detail {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 2rem;
  box-shadow: 1px 2px 6px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02);
  position: relative;
}

.maid-detail::before {
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

.maid-detail::after {
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

.maid-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.maid-header .maid-name {
  font-size: 1.5rem;
  color: var(--accent-bold);
}

/* Markdown content */
.maid-content {
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  font-size: 0.9rem;
  line-height: 1.7;
}
.maid-content .md-hash { opacity: 0.3; }
.maid-content h1 { font-size: 1.3rem; margin: 1.5rem 0 0.8rem; color: var(--accent); }
.maid-content h2 { font-size: 1.1rem; margin: 1.3rem 0 0.6rem; color: var(--accent); }
.maid-content p { margin-bottom: 0.8rem; }
.maid-content ul, .maid-content ol { margin: 0.5rem 0 1rem 0; list-style: none; }
.maid-content li { margin-bottom: 0.3rem; }
.maid-content code {
  background: var(--bg);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

/* Maid CTA */
.maid-cta {
  font-family: var(--font-sans);
  text-align: center;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  color: var(--text-muted);
}

.maid-cta code {
  background: var(--border);
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.maid-cta a {
  color: var(--accent);
  text-decoration: none;
  font-weight: bold;
  white-space: nowrap;
}

.maid-cta a:hover {
  text-decoration: underline;
}

/* Site Footer */
.site-footer {
  text-align: center;
  padding: 4rem 1.5rem 2rem;
  font-size: 0.7rem;
  font-family: var(--font-sans);
}

.site-footer a {
  color: var(--text-muted);
  text-decoration: none;
  opacity: 0.4;
}

.site-footer a:hover {
  opacity: 0.6;
}

/* Not Found */
.not-found {
  text-align: center;
  padding: 3rem 1rem;
}

.not-found h1 {
  font-size: 1.4rem;
  color: var(--accent);
  margin-bottom: 2rem;
}

.not-found-quote {
  font-size: 1.05rem;
  font-style: italic;
  color: var(--text);
  margin-bottom: 0.3rem;
}

.not-found-maid {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 2.5rem;
}

.not-found-back a {
  color: var(--accent);
  text-decoration: none;
  font-family: var(--font-sans);
  font-size: 0.95rem;
}

.not-found-back a:hover {
  text-decoration: underline;
}

`;
