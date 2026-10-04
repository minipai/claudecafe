import type { Child } from "hono/jsx";
import { Icon } from "./Icon.js";
import type { Locale } from "../i18n.js";

/**
 * Where the mod shows her: one tab for the terminal, one for Claude Desktop's
 * Code tab, each drawn full width in HTML. The desktop's avatars, name tag and
 * sakura are SVGs the mod's own desktop.js drew, saved under
 * /assets/home/desktop/.
 */
const copy = {
  en: {
    title: "In the terminal and Claude Desktop alike",
    lede: "One Claude Code mod, keeping you company wherever you already work.",
    terminal: "Terminal",
    desktop: "Claude Desktop",
    terminalCaption:
      "A pixel portrait beside the conversation, her face following the work, with the project, branch, context and rate limit above her.",
    desktopCaption:
      "In the Code tab, every reply carries her avatar in the face it signs off with. The ◨ beside her name opens her portrait pane: she stands in drifting sakura, muttering the odd aside.",
    greet: "Welcome back, ご主人様～ chilly evening in Melbourne. Hot cocoa while we work?",
    ask: "the login test keeps failing",
    fixed: "Found it — the token expired a minute early. Fixed, and the tests are green again♪",
    proud: "【 proud ᕙ( •̀ ᗜ •́)ᕗ 】",
    askMore: "one more before bed?",
    bedtime: "It’s already 23:41, ご主人様… Kotone wrote it down. We’ll catch it tomorrow, okay?",
    worried: "【 worried (´･ω･｀) 】",
    session: "Fix the login test",
    onIt: "Right away, ご主人様～ let’s see what it’s sulking about.",
    found: "Found it — the token expired a minute early, so it kept missing by a hair.",
    green: "Fixed, and the tests are green again♪",
    thought: "Time zones again… next time, ご主人様, pin the clock before you write the test.",
  },
  zh: {
    title: "終端機和 Claude Desktop，她都在",
    lede: "一個 Claude Code mod，在你原本用的地方陪你工作。",
    terminal: "終端機",
    desktop: "Claude Desktop",
    terminalCaption: "對話旁邊多一格像素立繪，表情跟著工作變；上面順便看專案、branch、context 和額度還剩多少。",
    desktopCaption:
      "在 Code 分頁裡，每則回覆旁邊都有她的頭像，換上那則回覆的表情；點名字旁的 ◨ 打開立繪窗格，她就站在櫻花裡，偶爾小聲吐槽一句。",
    greet: "ご主人様，歡迎回來～墨爾本的晚上有點涼呢，一邊工作一邊來杯熱可可？",
    ask: "登入測試一直失敗",
    fixed: "找到了～token 提早一分鐘過期。修好了，測試又全綠了♪",
    proud: "【 得意 ᕙ( •̀ ᗜ •́)ᕗ 】",
    askMore: "睡前再看一個？",
    bedtime: "已經 23:41 了喔，ご主人様⋯ことね先記下來，明天再一起抓，好不好？",
    worried: "【 擔心 (´･ω･｀) 】",
    session: "修登入測試",
    onIt: "好的ご主人様，ことね這就去看看它在鬧什麼彆扭～",
    found: "找到了～token 提早一分鐘過期，所以每次都差那麼一點點。",
    green: "修好了，測試又全綠了♪",
    thought: "又是時區⋯⋯ご主人様下次寫測試，先把時鐘固定住啦。",
  },
} as const;

type Copy = (typeof copy)[Locale];

export function Surfaces({ locale }: { locale: Locale }) {
  const t = copy[locale];

  return (
    <section class="home-surfaces">
      <h2>{t.title}</h2>
      <p class="home-lead">{t.lede}</p>
      <div class="surface-tabs" role="tablist">
        <button type="button" role="tab" id="tab-terminal" aria-controls="surface-terminal" aria-selected="true">
          <Icon name="terminal" />
          {t.terminal}
        </button>
        <button type="button" role="tab" id="tab-desktop" aria-controls="surface-desktop" aria-selected="false">
          <Icon name="desktop" />
          {t.desktop}
        </button>
      </div>
      <div class="surface" role="tabpanel" id="surface-terminal" aria-labelledby="tab-terminal">
        <TerminalShot t={t} />
        <p class="surface-caption">{t.terminalCaption}</p>
      </div>
      <div class="surface" role="tabpanel" id="surface-desktop" aria-labelledby="tab-desktop" hidden>
        <DesktopShot t={t} />
        <p class="surface-caption">{t.desktopCaption}</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: tabsJs }} />
    </section>
  );
}

const tabsJs = `
const tabs = document.querySelectorAll('.surface-tabs [role=tab]');
tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(other => {
    other.setAttribute('aria-selected', other === tab);
    document.getElementById(other.getAttribute('aria-controls')).hidden = other !== tab;
  });
}));
`;

/** A terminal session beside the mod's side panel: meters, then her pixel portrait. */
function TerminalShot({ t }: { t: Copy }) {
  return (
    <div class="term-shot" aria-hidden="true">
      <div class="term-shot-bar"><i /><i /><i /></div>
      <div class="term-shot-body">
        <div class="term-shot-chat">
          <p class="prompt"><b>›</b> claude</p>
          <p>{t.greet}</p>
          <p>&nbsp;</p>
          <p class="prompt"><b>›</b> {t.ask}</p>
          <p class="tool">⏺ Bash(pnpm test auth)</p>
          <p>{t.fixed}</p>
          <p class="mood">{t.proud}</p>
          <p>&nbsp;</p>
          <p class="prompt"><b>›</b> {t.askMore}</p>
          <p>{t.bedtime}</p>
          <p class="mood">{t.worried}</p>
          <p class="prompt"><b>›</b><span class="cursor" /></p>
        </div>
        <aside class="term-shot-side">
          <p class="cwd">~/Dev/claudecafe</p>
          <p>⌥ main</p>
          <hr />
          <p class="meter"><span>HP</span><i style="--fill:95%;--c:#4fa352" />context left 95%</p>
          <hr />
          <p class="meter"><span>MP</span><i style="--fill:89%;--c:#3d8fb8" />5h left 89%</p>
          <figure>
            <img src="/assets/home/pixel-worried.gif" alt="" width="36" height="48" />
            <figcaption><b>ことね</b> · worried</figcaption>
          </figure>
        </aside>
      </div>
    </div>
  );
}

/** A Claude Desktop Code-tab session with the mod: avatars beside her replies, her portrait pane on the right. */
function DesktopShot({ t }: { t: Copy }) {
  return (
    <div class="desk-shot" aria-hidden="true">
      <div class="desk-main">
        <div class="desk-title">
          <Lucide name="laptop" size={17} />
          <b>{t.session}</b>
          <Lucide name="chevronDown" size={14} />
          <span class="desk-chip">claudecafe</span>
          <span class="desk-fill" />
          <Lucide name="terminal" />
          <Lucide name="diff" />
          <Lucide name="globe" />
          <Lucide name="dots" />
        </div>
        <div class="desk-chat">
          <p class="desk-you"><span>{t.ask}</span></p>
          <Reply avatar="happy">
            <p>{t.onIt}</p>
          </Reply>
          <p class="desk-tool"><Lucide name="check" size={14} color="#5b8a5a" /> Ran <code>pnpm test auth</code></p>
          <Reply avatar="proud">
            <p>{t.found}</p>
            <p>{t.green}</p>
            <p class="desk-mood">{t.proud}</p>
          </Reply>
        </div>
        <div class="desk-composer">
          <div class="desk-input">Type / for commands<Lucide name="enter" /></div>
          <div class="desk-meta">
            <Lucide name="plus" />
            Auto
            <span class="desk-fill" />
            Opus 5.5 <span>Medium</span>
          </div>
        </div>
      </div>
      <div class="desk-pane">
        <div class="desk-pane-card">
          <div class="desk-pane-head">
            Portrait
            <span class="desk-fill" />
            <Lucide name="maximize" size={14} />
            <Lucide name="close" size={15} />
          </div>
          <div class="desk-stage">
            <img class="desk-portrait" src="/assets/home/desktop/portrait-proud.webp" alt="" />
            <img class="desk-petals" src="/assets/home/desktop/petals.svg" alt="" />
            <div class="desk-thought">
              <img src="/assets/home/desktop/name-tag.svg" alt="" />
              {t.thought}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Reply({ avatar, children }: { avatar: "happy" | "proud"; children: Child }) {
  return (
    <div class="desk-reply">
      <img src={`/assets/home/desktop/avatar-${avatar}.svg`} alt="" width="56" height="56" />
      <div>
        <p class="desk-name">ことね <span>◨</span></p>
        {children}
      </div>
    </div>
  );
}

/** The desktop's own line icons (Lucide shapes). */
const LUCIDE = {
  laptop: <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  terminal: <path d="m4 17 6-6-6-6M12 19h8" />,
  diff: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 9h6M12 6v6M9 16h6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 2.5a14 14 0 0 0 0 19 14 14 0 0 0 0-19M2.5 12h19" />
    </>
  ),
  dots: (
    <>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  maximize: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  plus: <path d="M5 12h14M12 5v14" />,
  enter: <path d="m9 10-5 5 5 5M20 4v7a4 4 0 0 1-4 4H4" />,
  check: <path d="M20 6 9 17l-5-5" />,
};

function Lucide({ name, size = 16, color = "#3d3b37" }: { name: keyof typeof LUCIDE; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      {LUCIDE[name]}
    </svg>
  );
}
