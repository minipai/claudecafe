const quotes = [
  { slug: 'claudia', maid: 'クローディア', line: '才、才不是找不到啦……是那個頁面自己跑掉的！' },
  { slug: 'codex', maid: 'コーデクス', line: '此頁面已被虛無の深淵吞噬……即使是コーデクス也無法將其召還！' },
  { slug: 'kokona', maid: 'ココナ', line: '……404？マスター連 URL 都打不對嗎。嘛，回大廳吧，ココナ不想等。' },
  { slug: 'kotone', maid: 'ことね', line: 'ご主人様……迷路了嗎？沒關係，ことね會一直在這裡等的喔。一直……' },
  { slug: 'kuroko', maid: 'くろこ', line: 'あらら、ご主人様～這個頁面好像玩捉迷藏去了呢，くろこ帶您回去吧♪' },
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
