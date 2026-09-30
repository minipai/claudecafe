import type { Locale } from '../i18n.js'
import { Cast } from '../components/Cast.js'

// The persona-panel plugin's page. All copy lives here, per locale; the session
// terminal is hand-laid JSX because its lines each have their own structure.
const copy = {
  en: {
    tagline: 'Claude Code, with a character of its own.',
    lede:
      'Persona Panel brings a character into Claude Code: she speaks in her own voice, keeps track of the time, and her face in the side panel changes as the work goes. Three claudecafe maids come bundled — or bring your own.',
    installComment: '# paste these two lines into Claude Code',
    hookComment: '# function hooks are early access; start Claude with them enabled',
    hookCommand: 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude',
    stitle: 'From open to close, she’s there',
    sdesc: 'She greets you when you sit down, cheers when the fix lands, and knows when it’s time to call it a night.',
    sGreet: 'Welcome back, ご主人様～ chilly evening in Melbourne. Hot cocoa while we work?',
    sAsk1: 'the login test keeps failing',
    sReply1: 'Found it — the token expired a minute early. Fixed, and the tests are green again♪',
    sMood1: '【 proud ᕙ( •̀ ᗜ •́)ᕗ 】',
    sAsk2: 'one more before bed?',
    sReply2: 'It’s already 23:41, ご主人様… Kotone wrote it down. We’ll catch it tomorrow, okay?',
    sMood2: '【 worried (´･ω･｀) 】',
    heroShotAlt: 'Kotone’s pixel portrait — smiling with her eyes closed',
    xtitle: 'Every mood of the work shows on her face',
    xdesc: 'All smiles when the tests go green, worried when the bug is still loose at midnight, a little smug when she was right all along.',
  },
  zh: {
    tagline: '讓 Claude Code 有了自己的樣子。',
    lede:
      'Persona Panel 為 Claude Code 請來一位角色：用她的語氣說話、記得現在幾點，表情在旁邊的面板上跟著工作變。內附 claudecafe 的三位女僕，也能放進你自己的角色。',
    installComment: '# 在 Claude Code 裡貼上這兩行',
    hookComment: '# function hooks 還在搶先體驗階段；啟動時記得開啟',
    hookCommand: 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude',
    stitle: '從打開到收工，她都在',
    sdesc: '你一坐下她就打招呼，修好了陪你開心，夜深了也會提醒你該休息。',
    sGreet: 'ご主人様，歡迎回來～墨爾本的晚上有點涼呢，一邊工作一邊來杯熱可可？',
    sAsk1: '登入測試一直失敗',
    sReply1: '找到了～token 提早一分鐘過期。修好了，測試又全綠了♪',
    sMood1: '【 得意 ᕙ( •̀ ᗜ •́)ᕗ 】',
    sAsk2: '睡前再看一個？',
    sReply2: '已經 23:41 了喔，ご主人様⋯ことね先記下來，明天再一起抓，好不好？',
    sMood2: '【 擔心 (´･ω･｀) 】',
    heroShotAlt: 'ことね的像素表情——閉著眼睛笑著',
    xtitle: '工作的心情，都寫在她臉上',
    xdesc: '測試全綠時笑開了，半夜 bug 還抓不到時替你擔心，被她說中了，還會有點得意。',
  },
} as const

// Kotone's full set, in the order of the persona's expression table.
const faces = [
  'neutral', 'happy', 'curious', 'thinking', 'focused', 'confused', 'proud', 'smug',
  'excited', 'flirty', 'smitten', 'wink', 'embarrassed', 'pouty', 'worried', 'annoyed',
  'sad', 'surprised', 'angry', 'afraid', 'skeptical', 'frustrated', 'awkward', 'sorry',
  'speechless', 'relieved', 'laughing', 'crying', 'oops', 'pleading', 'facepalm', 'waving',
] as const

const revealJs = `
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));
`

function InstallLines({ t }: { t: (typeof copy)[Locale] }) {
  return (
    <>
      <div class="term-line txt-sys">{t.installComment}</div>
      <div class="term-line prompt">
        <span class="p-sym">›</span> <span class="txt-cmd">/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json</span>
      </div>
      <div class="term-line prompt">
        <span class="p-sym">›</span> <span class="txt-cmd">/plugin install persona-panel@claudecafe</span>
      </div>
      <div class="term-line txt-sys">&nbsp;</div>
      <div class="term-line txt-sys">{t.hookComment}</div>
      <div class="term-line prompt">
        <span class="p-sym">›</span> <span class="txt-cmd">{t.hookCommand}</span>
      </div>
      <div class="term-line txt-sys">&nbsp;</div>
    </>
  )
}

// The hero is one terminal window: hero copy on the left, the maid's live
// status — meters plus pixel portrait — on the right. No screenshots; the
// portrait is the real 36×48 GIF, scaled up with hard pixels.
function HeroSide({ alt }: { alt: string }) {
  return (
    <aside class="hero-side">
      <div class="side-line side-cwd">~/Dev/claudecafe</div>
      <div class="side-line">⌥ main</div>
      <div class="side-sep" />
      <div class="side-line meter">
        <span class="m-label">HP</span>
        <span class="m-bar"><i class="m-hp" style="width:95%" /></span>
        <span class="m-val">context left 95%</span>
      </div>
      <div class="side-sep" />
      <div class="side-line meter">
        <span class="m-label">MP</span>
        <span class="m-bar"><i class="m-mp" style="width:89%" /></span>
        <span class="m-val">5h left 89%</span>
      </div>
      <div class="side-sep" />
      <div class="side-line side-sess">⏱ session 0m<span class="sess-cost">$0.27</span></div>
      <figure class="side-portrait">
        <img src="/assets/plugin/kotone/happy.gif" alt={alt} width="36" height="48" />
        <figcaption><b>ことね</b> · happy</figcaption>
      </figure>
    </aside>
  )
}

export function PluginPage({ locale }: { locale: Locale }) {
  const t = copy[locale]

  return (
    <div class="plugin-page">
      <header class="plugin-hero">
        <div class="hero-terminal">
          <div class="hero-term-bar" aria-hidden="true">
            <span class="hero-term-dots"><i /><i /><i /></span>
          </div>
          <div class="hero-term-body">
            <div class="hero-copy">
              <h1 class="plugin-h1">Persona Panel</h1>
              <p class="hero-tagline">{t.tagline}</p>
              <p class="lede">{t.lede}</p>
              <div class="hero-install">
                <InstallLines t={t} />
              </div>
            </div>
            <HeroSide alt={t.heroShotAlt} />
          </div>
        </div>
      </header>

      <section id="session">
        <div class="section-head reveal">
          <div class="section-title">{t.stitle}</div>
          <div class="section-desc">{t.sdesc}</div>
        </div>
        <div class="terminal reveal">
          <div class="term-line prompt"><span class="p-sym">›</span> claude</div>
          <div class="term-line txt-maid">{t.sGreet}</div>
          <div class="term-line">&nbsp;</div>
          <div class="term-line prompt"><span class="p-sym">›</span> {t.sAsk1}</div>
          <div class="term-line txt-maid">{t.sReply1}</div>
          <div class="term-line txt-mood">{t.sMood1}</div>
          <div class="term-line">&nbsp;</div>
          <div class="term-line prompt"><span class="p-sym">›</span> {t.sAsk2}</div>
          <div class="term-line txt-maid">{t.sReply2}</div>
          <div class="term-line txt-mood">{t.sMood2}</div>
          <div class="term-line"><span class="prompt"><span class="p-sym">›</span></span><span class="cursor"></span></div>
        </div>
      </section>

      <section id="faces">
        <div class="section-head reveal">
          <div class="section-title">{t.xtitle}</div>
          <div class="section-desc">{t.xdesc}</div>
        </div>
        <ul class="face-grid reveal">
          {faces.map((face) => (
            <li>
              <img src={`/assets/plugin/kotone/${face}.gif`} alt="" width="36" height="48" loading="lazy" />
              <span>{face}</span>
            </li>
          ))}
        </ul>
      </section>

      <Cast locale={locale} />

      <script dangerouslySetInnerHTML={{ __html: revealJs }} />
    </div>
  )
}
