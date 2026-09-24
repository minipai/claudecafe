import type { Maid } from "../utils/maids.js";
import { MaidCard } from "./MaidCard.js";
import { href, type Locale } from "../i18n.js";

/** Who greets you at the door. The rest of the cast keeps their pages; the
 * homepage only introduces these three. */
const ON_SHIFT = ["kurumi", "kotone", "kokona"];

const copy = {
  en: {
    h1: "おかえりなさいませ",
    h1sub: "Welcome home, Goshujin-sama.",
    lead1: "Every time you open Claude Code,",
    lead2: "someone is there, waiting for you.",
    ctaDesktop: "Desktop app",
    ctaTerminal: "Terminal plugin",
    shiftTitle: "Same Claude Code, a different vibe",
    shiftLede: "She still fixes your bugs and writes your code — she just talks to you like she cares.",
    // One late night, three moments: she greets you, notices the hour, and
    // signs off with her mood.
    shiftChat: [
      {
        you: null,
        her: "Welcome home, Goshujin-sama~ still working this late? It’s chilly in Melbourne tonight — hot cocoa first.",
        mood: null,
      },
      {
        you: "the tests broke again…",
        her: "Aww, are they sulking again? Kotone will coax them back ♪ …it’s past two, though. Bed after this one, okay?",
        mood: null,
      },
      {
        you: "done yet?",
        her: "All fixed~ a restart and they’re happy again! Will Goshujin-sama praise Kotone?",
        mood: "【 happy (˶ˆᗜˆ˵) 】",
      },
    ],
    appTitle: "A face for every mood",
    appLede: "She beams when things go well, blushes when you praise her, and sulks when a bug won’t budge.",
    waysTitle: "Take her home",
    waysLede: "Two ways in — the same maid.",
    ways: [
      {
        href: "/app",
        title: "Desktop app",
        desc: "A little window of her own: she stands beside the conversation, her face changing as you talk.",
        meta: ["macOS · Apple silicon", "Needs Claude Code, signed in"],
        cta: "Get the app",
      },
      {
        href: "/plugin",
        title: "Terminal plugin",
        desc: "No new tools — she keeps you company in the terminal you already use, every session.",
        meta: ["Claude Code · Codex · OpenCode", "Two lines to install"],
        cta: "Install the plugin",
      },
    ],
    castTitle: "Pick your maid",
    castLede: "Each with her own personality, and her own way of talking.",
  },
  zh: {
    h1: "おかえりなさいませ",
    h1sub: "歡迎回來，ご主人様。",
    lead1: "每次打開 Claude Code，",
    lead2: "都有人在等你。",
    ctaDesktop: "桌面 App",
    ctaTerminal: "終端機 Plugin",
    shiftTitle: "同樣的 Claude Code，換一種氛圍",
    shiftLede: "一樣幫你修 bug、寫程式，只是跟你說話的方式變溫暖了。",
    shiftChat: [
      {
        you: null,
        her: "ご主人様，歡迎回來～這麼晚還在忙呀？Melbourne 今晚有點涼，先來杯熱可可吧。",
        mood: null,
      },
      {
        you: "測試又掛了……",
        her: "欸～它又在鬧彆扭了嗎？ことね來哄哄它 ♪ ……不過已經兩點多了喔，修完這個就去睡覺，好不好？",
        mood: null,
      },
      {
        you: "好了嗎？",
        her: "修好了～重新啟動就乖乖的了！ご主人様，要誇誇ことね嗎？",
        mood: "【 開心 (˶ˆᗜˆ˵) 】",
      },
    ],
    appTitle: "豐富的表情",
    appLede: "事情順利會笑，被誇獎會害羞，bug 抓不到會鬧彆扭。",
    waysTitle: "帶她回家",
    waysLede: "兩種方式，同一位女僕。",
    ways: [
      {
        href: "/app",
        title: "桌面 App",
        desc: "一個屬於她的小視窗，她就站在對話旁邊，表情跟著你們的對話變化。",
        meta: ["macOS · Apple 晶片", "需要已登入的 Claude Code"],
        cta: "下載桌面 App",
      },
      {
        href: "/plugin",
        title: "終端機 Plugin",
        desc: "不用換工具，在你原本的終端機裡，每個 session 都有她陪著。",
        meta: ["Claude Code · Codex · OpenCode", "貼上兩行指令就裝好"],
        cta: "安裝 Plugin",
      },
    ],
    castTitle: "挑一位女僕",
    castLede: "每一位都有自己的個性，和自己說話的方式。",
  },
} as const;

/** Cropped by scripts/home-faces.sh, which keeps the same list. */
const FACES = [
  "happy", "curious", "thinking", "embarrassed",
  "pouty", "surprised", "proud", "sad",
  "wink", "smug", "worried", "angry",
  "confused", "sorry", "relieved", "excited",
].map((name) => ({ name, src: `/assets/home/faces/${name}.webp` }));

export function HomePage({ maids, locale }: { maids: Maid[]; locale: Locale }) {
  const t = copy[locale];
  const cast = ON_SHIFT.map((slug) => maids.find((m) => m.slug === slug)).filter((m) => m !== undefined);

  return (
    <div class="home">
      {/* Snap stops at both ends, so the pinned story can be left either way. */}
      <i class="home-top-stop" />
      <div class="home-story">
        <div class="home-stage">
          <div class="home-maid">
            <div class="home-frame">
              <video data-clip="0-1" src="/assets/home/full-portrait.mp4" poster="/assets/home/full.webp" muted playsinline preload="auto" class="on" />
              <video data-clip="1-2" src="/assets/home/portrait-face.mp4" muted playsinline preload="auto" />
              <video data-clip="2-1" src="/assets/home/face-portrait.mp4" muted playsinline preload="auto" />
              <video data-clip="1-0" src="/assets/home/portrait-full.mp4" muted playsinline preload="auto" />
            </div>
          </div>

          <div class="home-slides">
            <header class="home-slide home-hello on">
              <h1>
                {t.h1}
                <small>{t.h1sub}</small>
              </h1>
              <p class="home-lead">
                {t.lead1}
                <br />
                {t.lead2}
              </p>
              <nav class="home-cta">
                <a class="home-pill" href={href(locale, "/app")}>{t.ctaDesktop}</a>
                <a class="home-pill" href={href(locale, "/plugin")}>{t.ctaTerminal}</a>
              </nav>
            </header>

            <section class="home-slide">
              <h2>{t.shiftTitle}</h2>
              <p class="home-lead">{t.shiftLede}</p>
              <ol class="home-chat">
                {t.shiftChat.map(({ you, her, mood }) => (
                  <li>
                    {you && <p class="home-chat-you">{you}</p>}
                    <p class="home-chat-her" data-name="ことね">
                      {her}
                      {mood && <span class="home-chat-mood">{mood}</span>}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section class="home-slide">
              <h2>{t.appTitle}</h2>
              <p class="home-lead">{t.appLede}</p>
              <ul class="home-faces">
                {FACES.map((face) => (
                  <li><img src={face.src} alt={face.name} loading="lazy" /></li>
                ))}
              </ul>
            </section>

          </div>
          <div class="home-dots"><i class="on" /><i /><i /></div>
        </div>

        {/* One snap stop per slide, each a screen tall. */}
        <div class="home-stops">
          <i data-step="0" style="--n:0" />
          <i data-step="1" style="--n:1" />
          <i data-step="2" style="--n:2" />
        </div>
      </div>

      <div class="home-end">
        {/* The hero's two buttons again, now with what each one means. */}
        <section class="home-ways">
          <h2>{t.waysTitle}</h2>
          <p class="home-lead">{t.waysLede}</p>
          <div class="home-way-list">
            {t.ways.map((way) => (
              <article class="home-way">
                <h3>{way.title}</h3>
                <p>{way.desc}</p>
                <ul>
                  {way.meta.map((line) => (
                    <li>{line}</li>
                  ))}
                </ul>
                <a class="home-pill" href={href(locale, way.href)}>{way.cta}</a>
              </article>
            ))}
          </div>
        </section>

        <section class="home-cast">
          <h2>{t.castTitle}</h2>
          <p class="home-lead">{t.castLede}</p>
        </section>

        <div class="maid-list">
          {cast.map((maid) => (
            <MaidCard maid={maid} locale={locale} />
          ))}
        </div>
        <footer class="site-footer">
          <a
            href="https://www.flaticon.com/free-icon/bow_12575123"
            title="bow icons"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ribbon icon by Nur syifa fauziah
          </a>
        </footer>
      </div>

      <script dangerouslySetInnerHTML={{ __html: homeJs }} />
    </div>
  );
}

/** Two jobs: walk her from pose to pose as the slides change, and snap only
 * while the story is pinned (the rest of the page scrolls freely). */
const homeJs = `
const clips = Object.fromEntries([...document.querySelectorAll('.home-frame video')].map(v => [v.dataset.clip, v]));
const dots = document.querySelectorAll('.home-dots i');
const slides = document.querySelectorAll('.home-slide');
let pose = 0, target = 0, walking = false;

// One pose at a time: 01 to 03 plays full → portrait, then portrait → face.
async function walk() {
  if (walking) return;
  walking = true;
  while (pose !== target) {
    const next = pose + Math.sign(target - pose);
    const clip = clips[pose + '-' + next];
    Object.values(clips).forEach(v => v.classList.toggle('on', v === clip));
    clip.currentTime = 0;
    await clip.play().catch(() => {});
    if (!clip.ended) await new Promise(done => clip.addEventListener('ended', done, { once: true }));
    pose = next;
  }
  walking = false;
}

const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const step = Number(e.target.dataset.step);
    dots.forEach((d, i) => d.classList.toggle('on', i === step));
    slides.forEach((s, i) => {
      s.classList.toggle('on', i === step);
      s.classList.toggle('past', i < step);
    });
    target = step;
    walk();
  }
}, { threshold: 0.55 });
document.querySelectorAll('.home-stops i').forEach(s => io.observe(s));

// Once the story reaches the top it settles onto the nearest slide: the
// browser won't re-snap by itself when snapping is switched on mid-scroll.
const story = document.querySelector('.home-story');
let pinned = false;
function snapWhilePinned() {
  const r = story.getBoundingClientRect();
  const now = r.top <= 1 && r.bottom >= innerHeight - 1;
  document.documentElement.classList.toggle('home-snapping', now);
  if (now && !pinned) {
    const offset = Math.round(-r.top / innerHeight) * innerHeight;
    scrollTo({ top: scrollY + r.top + offset, behavior: 'smooth' });
  }
  pinned = now;
}
addEventListener('scroll', snapWhilePinned, { passive: true });
snapWhilePinned();
`;
