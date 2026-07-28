const quotes = [
  { slug: 'kanae', maid: 'かなえ', line: 'あら，走到沒有頁面的地方了呢。沒關係，旦那様把手給かなえ，帶你回去吧。' },
  { slug: 'kokona', maid: 'ここな', line: '……404？マスター連 URL 都打不對嗎。回大廳啦。別誤會，ここな只是不想一直等。' },
  { slug: 'kotone', maid: 'ことね', line: 'あらら、旦那様～這個頁面好像玩捉迷藏去了呢，ことね帶您回去吧♪' },
  { slug: 'kuroko', maid: 'くろこ', line: 'ご主人様……迷路了嗎？沒關係，くろこ會一直在這裡等的喔。一直……' },
  { slug: 'kurumi', maid: 'くるみ', line: '咦？這個頁面不見了……啊，是不是くるみ剛才不小心收起來了？' },
]

export function notFoundQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)]
}

export function NotFoundPage({ pick }: { pick: typeof quotes[number] }) {
  return (
    <div class="not-found">
      <h1>お探しの方はまだ café にいらっしゃいません</h1>
      <p class="not-found-quote">「{pick.line}」</p>
      <p class="not-found-maid">— {pick.maid}</p>
      <p class="not-found-back"><a href="/">← café</a></p>
    </div>
  )
}
