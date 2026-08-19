import type { Locale } from '../i18n.js'

/** The demo is the app itself, built for the web and served from Cloudflare —
 * the same window, running on its canned script because there is no Claude Code
 * behind a stranger's browser. It is framed rather than described: nothing said
 * about a maid on your desktop lands the way ten seconds with her does. */
const DEMO_URL = 'https://claudecafe.starcoder.dev/'

/** Where the built app is fetched from — object storage rather than the box
 * this site runs on, which would otherwise carry a 238 MB download and ship a
 * copy of it inside every deploy.
 *
 * Versioned and never overwritten: the shelf doubles as the archive, and a
 * release nobody can go back to is a release nobody should trust. */
const DOWNLOAD_URL = 'https://dl.starcoder.dev/ClaudeCafe-0.1.3-arm64.zip'

/** Fetch and unzip, as one copyable thing. No download button anywhere on the
 * page: a zip that arrives through a browser is quarantined by macOS and this
 * build carries no Developer ID to answer that with, so the button would hand
 * out an app that refuses to open. Fetched with curl, it opens on the first
 * double-click. */
const INSTALL_LINE = `curl -L ${DOWNLOAD_URL} -o /tmp/cc.zip && unzip -q /tmp/cc.zip -d /Applications`

/** She is the argument. The page says what the thing is and gets out of the
 * way — one line of what it is, the window itself, and how to take it home. */
const copy = {
  en: {
    name: 'ClaudeCafe',
    lede:
      'The same Claude Code you already run — your login, your skills, your MCP servers — with a maid standing in front of it instead of a prompt.',
    demoNote: 'The real window on a canned script. Nothing on your machine is touched.',
    demoHint: 'Best on a desktop-sized screen.',
    dlMeta: 'macOS · Apple silicon · v0.1.3 · 237 MB',
    dlNote:
      'From a terminal on purpose: this build is signed by nobody, and a zip that arrives through a browser is held back by macOS. Fetched this way, she opens on the first double-click.',
    dependsA: 'Depends on ',
    dependsB: ', signed in, and ',
    dependsC: '.',
    copy: 'copy',
    copied: 'copied',
  },
  zh: {
    name: 'ClaudeCafe',
    lede:
      '同一個 Claude Code——你的登入、你的 skills、你的 MCP 伺服器——只是站在你面前的是一位女僕，不是一行游標。',
    demoNote: '這就是那個視窗本人，跑的是預錄好的劇本，不會動到你電腦裡的任何東西。',
    demoHint: '在電腦上看最準。',
    dlMeta: 'macOS · Apple 晶片 · v0.1.3 · 237 MB',
    dlNote:
      '只給指令是有原因的：這個版本沒有任何簽名，用瀏覽器下載的壓縮檔會被 macOS 擋下來；用這行抓的不會，第一次雙擊就開得起來。',
    dependsA: '需要 ',
    dependsB: '（要先登入）和 ',
    dependsC: '。',
    copy: '複製',
    copied: '複製好了',
  },
} as const

type Copy = (typeof copy)[Locale]

/** Her window is rendered at desktop size inside the iframe and shrunk to
 * whatever width the page has. The ratio has to be measured rather than
 * written: CSS will not divide a length by a length.
 *
 * The copy button is here too. */
const pageJs = `
document.querySelectorAll('.app-demo').forEach((box) => {
  const wide = parseFloat(getComputedStyle(box).getPropertyValue('--demo-w'));
  const fit = () => box.style.setProperty('--demo-scale', String(box.clientWidth / wide));
  fit();
  new ResizeObserver(fit).observe(box);
});

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(btn.dataset.copy);
    const was = btn.textContent;
    btn.textContent = btn.dataset.done;
    setTimeout(() => { btn.textContent = was; }, 1600);
  });
});

const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.12 });
revealEls.forEach(el => io.observe(el));
`

export function AppPage({ locale }: { locale: Locale }) {
  const t = copy[locale]

  return (
    <div class="plugin-page app-page">
      <header class="app-head">
        <h1 class="app-h1">{t.name}</h1>
        <p class="lede">{t.lede}</p>
      </header>

      {/* No frame around her: a border here would put the window back in the
          box the app spends its life escaping. */}
      <div class="app-stage reveal">
        <div class="app-demo">
          <iframe src={DEMO_URL} title="ClaudeCafe" loading="lazy" allowtransparency scrolling="no" />
        </div>
        <p class="app-caption">
          {t.demoNote} <span class="app-demo-hint">{t.demoHint}</span>
        </p>
      </div>

      <div class="app-rule" />

      <section class="app-dl reveal">
        <div class="app-dl-meta">{t.dlMeta}</div>
        <div class="app-paper-line">
          <span class="p-sym">›</span>
          <code>{INSTALL_LINE}</code>
          <button type="button" class="app-copy" data-copy={INSTALL_LINE} data-done={t.copied}>
            {t.copy}
          </button>
        </div>
        <p class="app-dl-note">{t.dlNote}</p>
        {/* She brings neither of these: the login is Claude Code's and the
            café's hooks are python. Named, not explained. */}
        <p class="app-depends">
          {t.dependsA}
          <code>Claude Code</code>
          {t.dependsB}
          <code>python3</code>
          {t.dependsC}
        </p>
      </section>

      <script dangerouslySetInnerHTML={{ __html: pageJs }} />
    </div>
  )
}
