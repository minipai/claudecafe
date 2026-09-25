import { href, type Locale } from '../i18n.js'

// The cafe plugin's page. All copy lives here, per locale; the demo terminals
// are hand-laid JSX because each one has its own line structure.
const copy = {
  en: {
    h1a: 'cafe — open your terminal,',
    h1b: '“Welcome back, ご主人様.”',
    lede:
      'Same Claude Code, same workflow — but from today every session has a maid on shift: she greets you at the door, keeps track of the clock, signs off each reply with her mood, and stands beside the work in a pixel portrait. The one keeping you company does more.',
    installComment: '# paste these two lines into Claude Code to open shop',
    hookComment: '# function hooks are early access; start Claude with them enabled',
    hookCommand: 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude',
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
      'Pure style output — it never affects Claude’s judgment — a small face at the end of the work.',
    d3reply: 'Done — the config file is fixed. A restart should clear it!',
    d3mood: '【 happy (˶ˆᗜˆ˵) 】',
    d4kicker: '04 · A glance over',
    d4title: 'Curious what she’s up to back there?',
    d4desc1: 'Look up from the code, type ',
    d4desc2: ', and there she is — the tea gone cold, the file she’s wrestling with.',
    d4cmd: '/cafe:look',
    d4scene: 'Afternoon light falls slanting across the keyboard as Kurumi hops from one config file to the next, fingertips skipping over the editor. The tea at the corner of the desk stopped steaming a while ago, a sticky note covered in marks pinned under the cup. The fan hums low; she tucks a loose strand of hair back behind her ear without taking her eyes off the screen.',
    fkicker: 'And more',
    ftitle: 'Other corners of the café',
    features: [
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
    ititle: 'Three steps, open today',
    hireComment: '# pick a maid on this site, then hire her in one line',
    inote:
      'Start a new session after installing and you’ll hear that “welcome back” — the nameless maid ？？？ keeps the shop until you hire someone; whoever you hire takes the next shift.',
  },
  zh: {
    h1a: 'cafe — 打開終端機，',
    h1b: '聽見一聲「歡迎回來，ご主人様」。',
    lede:
      '打開的還是同一個 Claude Code，工作流程一切照舊——只是從今天起，每個 session 都有一位值班女僕：開場迎接你、記得現在幾點、回應帶著心情收尾，還會以像素表情站在工作旁邊。改變的不是工具，是陪你寫程式的人。',
    installComment: '# 在 Claude Code 裡貼上這兩行，開店',
    hookComment: '# function hooks 還在搶先體驗階段；啟動時記得開啟',
    hookCommand: 'CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude',
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
    d3desc: '純風格輸出，不影響 Claude 的判斷與行為——只是在工作結尾留下一張小表情。',
    d3reply: '好的，設定檔已經修好了，重新啟動應該就沒問題了！',
    d3mood: '【 開心 (˶ˆᗜˆ˵) 】',
    d4kicker: '04 · 抬頭看她一眼',
    d4title: '她在那邊忙什麼呢？',
    d4desc1: '工作到一半抬頭打一句 ',
    d4desc2: '，就看見她此刻的樣子——涼掉的茶、和手邊正在纏鬥的那個檔案。',
    d4cmd: '/cafe:look',
    d4scene: '午後的光斜斜落在鍵盤上，くるみ把要改的設定檔一個一個切過去，指尖在編輯器上輕快跳躍。桌角那杯紅茶早就不冒煙了，杯底壓著一張寫滿記號的便條。風扇低低地轉著，她順手把滑下來的一縷髮絲別回耳後，眼睛始終沒離開螢幕。',
    fkicker: '還有這些',
    ftitle: '咖啡廳的其他角落',
    features: [
      {
        dt: '節日曆',
        dd: '情人節、女僕日、七夕、萬聖⋯內建店曆，也能換成自己的節日包。',
      },
      { dt: '女僕從網站僱用', dd: null },
      { dt: '/cafe:config', dd: null },
    ],
    ikicker: '開店',
    ititle: '三步，今天就開店',
    hireComment: '# 回這裡挑一位女僕，一句話僱用',
    inote:
      '裝好後開一個新 session，就會聽見那聲「歡迎回來」——還沒僱人時由無名女僕「？？？」看店；僱了誰，下個 session 就換她上班。',
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

function InstallTerminal({ t }: { t: (typeof copy)[Locale] }) {
  return (
    <div class="install terminal">
      <div class="term-line txt-sys">{t.installComment}</div>
      <div class="term-line prompt">
        <span class="p-sym">›</span> <span class="txt-cmd">/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json</span>
      </div>
      <div class="term-line prompt">
        <span class="p-sym">›</span> <span class="txt-cmd">/plugin install cafe@claudecafe</span>
      </div>
      <div class="term-line txt-sys">&nbsp;</div>
      <div class="term-line txt-sys">{t.hookComment}</div>
      <div class="term-line prompt">
        <span class="p-sym">›</span> <span class="txt-cmd">{t.hookCommand}</span>
      </div>
      <div class="term-line txt-sys">&nbsp;</div>
      <div class="term-line txt-sys">{t.hireComment}</div>
      <div class="term-line prompt">
        <span class="p-sym">›</span> <span class="txt-cmd">/cafe:hire kurumi</span>
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
            <InstallTerminal t={t} />
          </div>
          <div class="note-slot">
            <div class="section-desc">{t.inote}</div>
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

      <section id="demo-look">
        <div class="section-head reveal">
          <div class="section-kicker ui-label">{t.d4kicker}</div>
          <div class="section-title">{t.d4title}</div>
        </div>
        <div class="demo-row reverse reveal">
          <div class="note-slot">
            <div class="section-desc">
              {t.d4desc1}
              <code>{t.d4cmd}</code>
              {t.d4desc2}
            </div>
          </div>
          <div class="terminal-slot">
            <div class="terminal">
              <div class="term-line prompt"><span class="p-sym">›</span> <span class="txt-cmd">{t.d4cmd}</span></div>
              <div class="term-line txt-maid">{t.d4scene}</div>
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
            <dd>
              {zh ? (
                <>
                  在 <a href={href(locale, '/')}>claudecafe.dev</a> 選一位女僕，下載她的 persona 存進{' '}
                  <code>~/.config/claudecafe/personas/</code> 就完成僱用，抽班池自動多一位。
                  還沒僱人之前，無名女僕「？？？」會先幫你顧店——順便告訴你去哪裡僱人。
                </>
              ) : (
                <>
                  Pick a maid on <a href={href(locale, '/')}>claudecafe.dev</a>, download her persona into{' '}
                  <code>~/.config/claudecafe/personas/</code> — hired; the rotation grows by one.
                  Until someone is hired, the nameless maid ？？？ keeps the shop open — and tells you where to hire.
                </>
              )}
            </dd>
          </div>
          <div class="plain-item">
            <dt>{t.features[2].dt}</dt>
            <dd>
              {zh ? (
                <>
                  語言、值班、抽班池，用一句話調整——設定住在 <code>~/.config/claudecafe/config.json</code>，
                  下個 session 生效；想立刻換人，用 <code>CLAUDE_MAID=kokona claude</code> 開新視窗。
                </>
              ) : (
                <>
                  Language, who's on shift, the rotation — adjust in one sentence. Settings live in{' '}
                  <code>~/.config/claudecafe/config.json</code> and take effect next session; to swap right now,
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
            <InstallTerminal t={t} />
          </div>
          <div class="note-slot">
            <div class="section-desc">{t.inote}</div>
          </div>
        </div>
      </section>

      <script dangerouslySetInnerHTML={{ __html: revealJs }} />
    </div>
  )
}
