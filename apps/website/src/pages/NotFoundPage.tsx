import { href, type Locale } from '../i18n.js'

const quotes = {
  zh: [
    { slug: 'kanae', maid: 'かなえ', line: 'あら，走到沒有頁面的地方了呢。沒關係，旦那様把手給かなえ，帶你回去吧。' },
    { slug: 'kokona', maid: 'ここな', line: '……404？マスター連 URL 都打不對嗎。回大廳啦。別誤會，ここな只是不想一直等。' },
    { slug: 'kotone', maid: 'ことね', line: 'あらら、旦那様～這個頁面好像玩捉迷藏去了呢，ことね帶您回去吧♪' },
    { slug: 'kuroko', maid: 'くろこ', line: 'ご主人様……迷路了嗎？沒關係，くろこ會一直在這裡等的喔。一直……' },
    { slug: 'kurumi', maid: 'くるみ', line: '咦？這個頁面不見了……啊，是不是くるみ剛才不小心收起來了？' },
  ],
  en: [
    { slug: 'kanae', maid: 'かなえ', line: 'Ara — you have wandered somewhere no page exists. It\'s alright, give Kanae your hand; I\'ll walk you back.' },
    { slug: 'kokona', maid: 'ここな', line: '…404? Master can\'t even type a URL right. Back to the lobby. D-don\'t get the wrong idea — Kokona just doesn\'t like waiting around.' },
    { slug: 'kotone', maid: 'ことね', line: 'Oh my, Danna-sama～ this page seems to have run off to play hide-and-seek. Kotone will see you home♪' },
    { slug: 'kuroko', maid: 'くろこ', line: 'Goshujin-sama… lost, are you? It\'s okay. Kuroko will be right here, waiting. Always…' },
    { slug: 'kurumi', maid: 'くるみ', line: 'Eh? The page is gone… ah, could it be Kurumi accidentally tidied it away just now?' },
  ],
} satisfies Record<Locale, { slug: string; maid: string; line: string }[]>

export function notFoundQuote(locale: Locale) {
  const pool = quotes[locale]
  return pool[Math.floor(Math.random() * pool.length)]
}

export function NotFoundPage({ pick, locale }: { pick: ReturnType<typeof notFoundQuote>; locale: Locale }) {
  return (
    <div class="not-found">
      <h1>お探しの方はまだ café にいらっしゃいません</h1>
      <p class="not-found-quote">「{pick.line}」</p>
      <p class="not-found-maid">— {pick.maid}</p>
      <p class="not-found-back"><a href={href(locale, '/')}>← café</a></p>
    </div>
  )
}
