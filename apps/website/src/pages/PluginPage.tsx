import { href, type Locale } from '../i18n.js'

// The cafe plugin's page. All copy lives here, per locale; the demo terminals
// are hand-laid JSX because each one has its own line structure.
const copy = {
  en: {
    h1a: 'cafe — open your terminal,',
    h1b: '“Welcome back, ご主人様.”',
    lede:
      'Same Claude Code, same workflow — but from today every session has a maid on shift: she greets you at the door, keeps track of the clock, and signs off each reply with her mood. The tool doesn’t change. The one keeping you company does.',
    installComment: '# paste these two lines into Claude Code to open shop',
    installNote1: 'For the status-line skit, run ',
    installNote2: ' after installing.',
    d1kicker: '01 · Session start',
    d1title: 'She checks the time and the weather, then greets you',
    d1desc:
      'Every new Claude Code session, the maid on shift reads the hour before she speaks — never a canned greeting.',
    d1sys: '[cafe] SessionStart · on shift: Kurumi',
    d1maid: 'Welcome back, ご主人様～ chilly evening in Melbourne, isn’t it. Hot cocoa first?',
    d2kicker: '02 · Time, every turn',
    d2title: 'She remembers what time it is — and what day',
    d2desc:
      'Each turn quietly hands Claude the current time, today’s commit count and the café calendar — the model’s clock no longer stops at session start.',
    d2prompt: 'have a look at this bug for me',
    d2sys: '(quietly handed to Claude — you never see it: 23:41 (Monday)｜16 commits today｜Cat-ear Day)',
    d2maid: 'ご主人様, it’s past midnight… Kurumi will write this bug down — we catch it tomorrow, okay?',
    d3kicker: '03 · Sign-off',
    d3title: 'Every reply closes with a mood',
    d3desc:
      'Pure style output — it never affects Claude’s judgment. Only the status-line skit borrows it to pick her expression.',
    d3reply: 'Done — the config file is fixed. A restart should clear it!',
    d3mood: '【 happy (˶ˆᗜˆ˵) 】',
    d4kicker: '04 · The status line',
    d4title: 'What she’s doing, always at the bottom',
    d4desc1: 'A two-line skit generated in the background — a new scene each time she finishes a task. Run ',
    d4desc2: ' to wire it up; unwired, nothing is generated.',
    d4work: 'Editing 3 files · updating config schema…',
    d4sys: 'Claude is working ',
    d4scene: 'Kurumi’s fingertips dance across the editor, hopping between the config files',
    d4speech: 'ご主人様～ everything’s tidied up!',
    fkicker: 'And more',
    ftitle: 'Other corners of the café',
    features: [
      {
        dt: 'Handover diary',
        dd: 'At session end, the maid on shift leaves one line in a shared diary for the next girl — and you can read back through it.',
      },
      {
        dt: 'Café calendar',
        dd: 'Valentine’s, Maid Day, Tanabata, Halloween… a built-in café calendar, swappable for your own.',
      },
      {
        dt: 'Maids are hired from this website',
        dd: null, // rendered inline (contains code)
      },
      {
        dt: '/cafe:config',
        dd: null, // rendered inline (contains code)
      },
    ],
    ikicker: 'Open shop',
    ititle: 'Two lines, open today',
    inote1: 'Start a new session after installing and you’ll hear that “welcome back”. For the status-line skit, run ',
    inote2: '.',
  },
  zh: {
    h1a: 'cafe — 打開終端機，',
    h1b: '聽見一聲「歡迎回來，ご主人様」。',
    lede:
      '打開的還是同一個 Claude Code，工作流程一切照舊——只是從今天起，每個 session 都有一位值班女僕：開場迎接你、記得現在幾點、回應帶著心情收尾。改變的不是工具，是陪你寫程式的人。',
    installComment: '# 在 Claude Code 裡貼上這兩行，開店',
    installNote1: '想要 status line 的小劇場，裝好後再跑一句 ',
    installNote2: '。',
    d1kicker: '01 · Session 開場',
    d1title: '她會看時間、看天氣，跟你打招呼',
    d1desc: '每次開新的 Claude Code session，值班女僕會先讀懂當下時段，再說出這句話——不是罐頭問候。',
    d1sys: '[cafe] SessionStart · 值班女僕：くるみ',
    d1maid: 'ご主人様、晚安～今天 Melbourne 有點涼呢，先來杯熱可可嗎？',
    d2kicker: '02 · 每回合報時',
    d2title: '她會記得現在幾點、今天是什麼日子',
    d2desc: '每回合悄悄告訴 Claude 當下時間、今天的 commit 數和店曆節日——模型的時鐘不再停在 session 開始那一刻。',
    d2prompt: '幫我看一下這個 bug',
    d2sys: '（悄悄遞給 Claude，你看不到：23:41 (Monday)｜16 commits today｜貓耳日）',
    d2maid: 'ご主人様，已經超過半夜了喔……這個 bug くるみ記下來，明天再抓好不好？',
    d3kicker: '03 · 回應結尾',
    d3title: '每則回應，帶著一枚心情收尾',
    d3desc: '純風格輸出，不影響 Claude 的判斷與行為——只有 status line 的小劇場會借它挑表情。',
    d3reply: '好的，設定檔已經修好了，重新啟動應該就沒問題了！',
    d3mood: '【 開心 (˶ˆᗜˆ˵) 】',
    d4kicker: '04 · 底部 Status Line',
    d4title: '她正在做什麼，一直顯示在最下面',
    d4desc1: '背景生成的兩行小劇場，她每做完一件事就換一幕。裝好後跑 ',
    d4desc2: ' 接上——不接就不生成。',
    d4work: 'Editing 3 files · updating config schema…',
    d4sys: 'Claude is working ',
    d4scene: 'くるみ的指尖在編輯器上輕快跳躍，逐個切換著要改的設定檔',
    d4speech: 'ご主人様～設定全部整理好了呢～',
    fkicker: '還有這些',
    ftitle: '咖啡廳的其他角落',
    features: [
      {
        dt: '交接簿日記',
        dd: 'session 結束時，值班女僕會在共用日記留一句話給下一位——你也能翻到過去的紀錄。',
      },
      {
        dt: '節日曆',
        dd: '情人節、女僕日、七夕、萬聖⋯內建店曆，也能換成自己的節日包。',
      },
      { dt: '女僕從網站僱用', dd: null },
      { dt: '/cafe:config', dd: null },
    ],
    ikicker: '開店',
    ititle: '兩行指令，今天就開店',
    inote1: '裝好後開一個新 session，就會聽見那聲「歡迎回來」。想要 status line 的小劇場，再跑一句 ',
    inote2: '。',
  },
} as const

const revealJs = `
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));
`

function InstallTerminal({ comment }: { comment: string }) {
  return (
    <div class="install terminal">
      <div class="term-line txt-sys">{comment}</div>
      <div class="term-line prompt">
        <span class="p-sym">›</span> <span class="txt-cmd">/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json</span>
      </div>
      <div class="term-line prompt">
        <span class="p-sym">›</span> <span class="txt-cmd">/plugin install cafe@claudecafe</span>
      </div>
    </div>
  )
}

export function PluginPage({ locale }: { locale: Locale }) {
  const t = copy[locale]
  const zh = locale === 'zh'

  return (
    <div class="plugin-page">
      <header class="plugin-hero">
        <h1 class="plugin-h1">
          {t.h1a}
          <br />
          <span class="accent">{t.h1b}</span>
        </h1>
        <p class="lede">{t.lede}</p>
        <div class="demo-row install-row">
          <div class="terminal-slot">
            <InstallTerminal comment={t.installComment} />
          </div>
          <div class="note-slot">
            <div class="section-desc">
              {t.installNote1}
              <code>/cafe:statusline</code>
              {t.installNote2}
            </div>
          </div>
        </div>
      </header>

      <section id="demo-greet">
        <div class="section-head reveal">
          <div class="section-kicker ui-label">{t.d1kicker}</div>
          <div class="section-title">{t.d1title}</div>
        </div>
        <div class="demo-row reveal">
          <div class="terminal-slot">
            <div class="terminal">
              <div class="term-line prompt"><span class="p-sym">›</span> claude</div>
              <div class="term-line txt-sys">{t.d1sys}</div>
              <div class="term-line txt-maid">{t.d1maid}</div>
              <div class="term-line"><span class="prompt"><span class="p-sym">›</span></span><span class="cursor"></span></div>
            </div>
          </div>
          <div class="note-slot">
            <div class="section-desc">{t.d1desc}</div>
          </div>
        </div>
      </section>

      <section id="demo-time">
        <div class="section-head reveal">
          <div class="section-kicker ui-label">{t.d2kicker}</div>
          <div class="section-title">{t.d2title}</div>
        </div>
        <div class="demo-row reverse reveal">
          <div class="note-slot">
            <div class="section-desc">{t.d2desc}</div>
          </div>
          <div class="terminal-slot">
            <div class="terminal">
              <div class="term-line prompt"><span class="p-sym">›</span> {t.d2prompt}</div>
              <div class="term-line txt-sys">{t.d2sys}</div>
              <div class="term-line txt-maid">{t.d2maid}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo-mood">
        <div class="section-head reveal">
          <div class="section-kicker ui-label">{t.d3kicker}</div>
          <div class="section-title">{t.d3title}</div>
        </div>
        <div class="demo-row reveal">
          <div class="terminal-slot">
            <div class="terminal">
              <div class="term-line">{t.d3reply}</div>
              <div class="term-line txt-mood">{t.d3mood}</div>
              <div class="term-line"><span class="prompt"><span class="p-sym">›</span></span><span class="cursor"></span></div>
            </div>
          </div>
          <div class="note-slot">
            <div class="section-desc">{t.d3desc}</div>
          </div>
        </div>
      </section>

      <section id="demo-status">
        <div class="section-head reveal">
          <div class="section-kicker ui-label">{t.d4kicker}</div>
          <div class="section-title">{t.d4title}</div>
        </div>
        <div class="demo-row reverse reveal">
          <div class="note-slot">
            <div class="section-desc">
              {t.d4desc1}
              <code>/cafe:statusline</code>
              {t.d4desc2}
            </div>
          </div>
          <div class="terminal-slot">
            <div class="terminal">
              <div class="term-line">{t.d4work}</div>
              <div class="term-line txt-sys">{t.d4sys}<span class="cursor"></span></div>
              <div class="statusline">
                <div class="sl-row">{t.d4scene}</div>
                <div class="sl-row">{t.d4speech}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features">
        <div class="section-head reveal">
          <div class="section-kicker ui-label">{t.fkicker}</div>
          <div class="section-title">{t.ftitle}</div>
        </div>
        <dl class="plain-list reveal">
          <div class="plain-item">
            <dt>{t.features[0].dt}</dt>
            <dd>{t.features[0].dd}</dd>
          </div>
          <div class="plain-item">
            <dt>{t.features[1].dt}</dt>
            <dd>{t.features[1].dd}</dd>
          </div>
          <div class="plain-item">
            <dt>{t.features[2].dt}</dt>
            <dd>
              {zh ? (
                <>
                  在 <a href={href(locale, '/')}>claudecafe.dev</a> 選一位女僕，下載她的 persona 存進{' '}
                  <code>~/.claude/cafe/personas/</code> 就完成僱用，抽班池自動多一位。
                  還沒僱人之前，無名女僕「？？？」會先幫你顧店——順便告訴你去哪裡僱人。
                </>
              ) : (
                <>
                  Pick a maid on <a href={href(locale, '/')}>claudecafe.dev</a>, download her persona into{' '}
                  <code>~/.claude/cafe/personas/</code> — hired; the rotation grows by one.
                  Until someone is hired, the nameless maid ？？？ keeps the shop open — and tells you where to hire.
                </>
              )}
            </dd>
          </div>
          <div class="plain-item">
            <dt>{t.features[3].dt}</dt>
            <dd>
              {zh ? (
                <>
                  語言、值班、抽班池，用一句話調整——設定住在 <code>~/.claude/cafe/config.json</code>，
                  下個 session 生效；想立刻換人，用 <code>CLAUDE_MAID=kokona claude</code> 開新視窗。
                </>
              ) : (
                <>
                  Language, who's on shift, the rotation — adjust in one sentence. Settings live in{' '}
                  <code>~/.claude/cafe/config.json</code> and take effect next session; to swap right now,
                  open a new window with <code>CLAUDE_MAID=kokona claude</code>.
                </>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section id="install">
        <div class="section-head reveal">
          <div class="section-kicker ui-label">{t.ikicker}</div>
          <div class="section-title">{t.ititle}</div>
        </div>
        <div class="demo-row install-row reveal">
          <div class="terminal-slot">
            <InstallTerminal comment={t.installComment} />
          </div>
          <div class="note-slot">
            <div class="section-desc">
              {t.inote1}
              <code>/cafe:statusline</code>
              {t.inote2}
            </div>
          </div>
        </div>
      </section>

      <script dangerouslySetInnerHTML={{ __html: revealJs }} />
    </div>
  )
}
