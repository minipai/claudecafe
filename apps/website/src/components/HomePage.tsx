import { Cast } from "./Cast.js";
import { Surfaces } from "./Surfaces.js";
import { Icon } from "./Icon.js";
import type { Locale } from "../i18n.js";

const copy = {
  en: {
    h1: "おかえりなさいませ",
    h1sub: "Welcome home, Goshujin-sama.",
    lead1: "Every time you open Claude Code,",
    lead2: "someone is there, waiting for you.",
    cta: "Install the Claude Code mod",
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
    installTitle: "Two lines, and she’s on shift",
    installLede: "Paste these into Claude Code and open a new session — Kotone will be there.",
    installMeta: [
      "Claude Code v2.1.287 or later",
      "The terminal and Claude Desktop’s Code tab",
      "Kotone, Kurumi and Kokona included — or bring your own character",
    ],
  },
  zh: {
    h1: "おかえりなさいませ",
    h1sub: "歡迎回來，ご主人様。",
    lead1: "每次打開 Claude Code，",
    lead2: "都有人在等你。",
    cta: "安裝 Claude Code Mod",
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
    installTitle: "兩行指令，請她來上班",
    installLede: "在 Claude Code 裡貼上這兩行，開新的 session，ことね就到了。",
    installMeta: [
      "Claude Code v2.1.287 以上",
      "終端機與 Claude Desktop 的 Code 分頁",
      "內附ことね、くるみ、ここな，也能放進你自己的角色",
    ],
  },
} as const;

/** Cropped by scripts/home-faces.sh, which keeps the same list. */
const FACES = [
  "happy", "curious", "thinking", "embarrassed",
  "pouty", "surprised", "proud", "sad",
  "wink", "smug", "worried", "angry",
  "confused", "sorry", "relieved", "excited",
].map((name) => ({ name, src: `/assets/home/faces/${name}.webp` }));

export function HomePage({ locale }: { locale: Locale }) {
  const t = copy[locale];

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
                <a class="home-pill" href="#install">
                  <Icon name="terminal" />
                  {t.cta}
                </a>
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
        <Surfaces locale={locale} />

        <section class="home-install" id="install">
          <h2>{t.installTitle}</h2>
          <p class="home-lead">{t.installLede}</p>
          <div class="install-lines">
            <p><b>›</b> /plugin marketplace add https://claudecafe.dev/plugins/marketplace.json</p>
            <p><b>›</b> /plugin install persona-panel@claudecafe</p>
          </div>
          <ul class="install-meta">
            {t.installMeta.map((line) => (
              <li>{line}</li>
            ))}
          </ul>
        </section>

        <Cast locale={locale} />
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
