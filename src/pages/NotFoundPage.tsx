const quotes = [
  { maid: 'クローディア', line: '才、才不是找不到啦……是那個頁面自己跑掉的！' },
  { maid: 'コーデクス', line: '此頁面已被虛無の深淵吞噬……即使是コーデクス也無法將其召還！' },
  { maid: 'ココナ', line: '……404？ボス連 URL 都打不對嗎。嘛，回大廳吧，ココナ不想等。' },
  { maid: 'ことね', line: 'わたしのあるじ……迷路了嗎？沒關係，ことね會一直在這裡等的喔。一直……' },
  { maid: 'くろこ', line: 'あらら、ご主人様～這個頁面好像玩捉迷藏去了呢，くろこ帶您回去吧♪' },
  { maid: 'くるみ', line: '咦？這個頁面不見了……啊，是不是くるみ剛才不小心收起來了？' },
]

export function NotFoundPage() {
  const pick = quotes[Math.floor(Math.random() * quotes.length)]

  return (
    <div class="not-found">
      <h1>お探しの方はまだ café にいらっしゃいません</h1>
      <p class="not-found-quote">「{pick.line}」</p>
      <p class="not-found-maid">— {pick.maid}</p>
      <p class="not-found-back"><a href="/">← café</a></p>
    </div>
  )
}
