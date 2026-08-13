/** Canned copy for the mock stream — stands in for real model output. */

export const SHORT_ANSWER = '喔～那個 API 預設 timeout 是 30 秒喔，不用另外設定～'

export const MEDIUM_INTRO = '讓ことね看一下這段～'

export const MEDIUM_ANSWER = `這段是 \`debounceQueue()\` 啦～它做的事情很單純：

- 把短時間內連續進來的寫入請求先收集起來
- 等 \`200ms\` 沒有新請求才真的送出去
- 避免同一個 session 被連續巴好幾次，浪費資源

簡單說就是幫您把「咚咚咚」打字產生的雜訊請求合併成一次送出，省資源又不會漏資料～`

export const HEAVY_INTRO = '收到！ことね馬上去查～'

export const HEAVY_DONE_LINE = '寫好了喔！ご主人様過目～'

export const HEAVY_DENIED_LINE = '咦…不行嗎…那、那ことね先不跑測試了喔…'

export const HEAVY_REPORT_MD = `# 登入流程間歇性逾時調查報告

**INCIDENT REPORT #482**　調查人：ことね｜狀態：已修復｜耗時：14 分鐘

## 問題現象

過去 24 小時內，約 3% 的登入請求會卡在 session 建立階段，使用者端顯示「請稍候」超過 8 秒後才逾時失敗。錯誤集中發生在流量尖峰（每小時整點附近），且只影響帶有「記住我」選項的登入請求。

## 追查過程

ことね先比對了尖峰時段的存取日誌，發現逾時請求都卡在同一段呼叫——寫入長效 session token 的資料庫操作。接著往上游追，鎖定到連線池設定：

> ＊翻開了 config.json，發現長效 session 的連線池上限只設了 5，遠低於一般 API 的 50。＊

尖峰時段同時湧入的「記住我」登入一多，就會把這 5 個連線用滿，後面的請求只能排隊，一路排到逾時。這也解釋了為什麼問題只在整點附近爆發——那正是使用者集中登入的時間。

## 修復方式

將長效 session 的連線池上限對齊一般 API 池，並加上排隊逾時的快速失敗機制，避免請求無限堆積：

\`\`\`ts
// config/session-pool.ts
export const longSessionPool = {
  max: 50,             // 5 → 50，對齊一般 API 池
  queueTimeoutMs: 1500, // 新增：排隊超過 1.5s 直接快速失敗
  idleTimeoutMs: 30000,
};
\`\`\`

ことね也順手補了一個小型壓力測試，模擬整點尖峰的登入洪峰，確認新設定下 p99 延遲從 8.2s 降到 210ms。

## 後續建議

- 幫連線池使用率加一條監控告警，超過 80% 就提前提醒，別再等到使用者反映。
- 「記住我」流程可以考慮做請求合併，減少尖峰瞬間的連線峰值。
- 下次改資源池設定時，麻煩附上壓測結果再上線～ことね這次是憑經驗猜的，有點心驚驚。

> ＊闔上了筆記本，滿意地點點頭＊ —— 以上就是這次的調查報告，ご主人様辛苦了！
`

/** In a real session she writes the link's wording herself, per report. */
export const HEAVY_REPORT = { label: '看看ことね查到什麼 →', body: HEAVY_REPORT_MD }

export const FAILURE_MESSAGE = 'Connection to the agent was lost.'

export const PLAN_INTRO = '好喔～ことね先把步驟排出來給ご主人様看看～'

export const PLAN_APPROVED_LINE = '那ことね照這個計畫開工囉！'

export const PLAN_REJECTED_LINE = '好…那ことね再重想一版計畫喔…'

/** ExitPlanMode hands the player a markdown plan and waits for a yes/no. */
export const PLAN_MD = `## 目標

把登入流程的連線池設定修好，讓尖峰時段不再逾時。

## 步驟

1. 讀 \`config/session-pool.ts\`，確認長效 session 池目前的上限。
2. 比對一般 API 池的設定，找出兩者差在哪。
3. 把上限對齊，並補上排隊逾時的快速失敗。
4. 跑一次壓力測試，確認 p99 有降下來。

## 會動到的檔案

- \`config/session-pool.ts\`（改設定）
- \`test/session-pool.bench.ts\`（新增壓測）

## 風險

改連線池上限會提高資料庫的同時連線數，上線前要先確認資料庫端的 max_connections 撐得住。
`

/** Edit tool input, exactly as the real SDK shapes it — the UI diffs the two strings itself. */
export const EDIT_REQUEST = {
  file_path: 'config/session-pool.ts',
  old_string: `export const longSessionPool = {
  max: 5,
  idleTimeoutMs: 30000,
};`,
  new_string: `export const longSessionPool = {
  max: 50,
  queueTimeoutMs: 1500,
  idleTimeoutMs: 30000,
};`,
}

export const EDIT_DENIED_LINE = '唔…那這個檔案ことね就不動了喔。'

/** The model thinking out loud, shown as thought bubbles while it works. */
export const HEAVY_THOUGHTS = [
  { text: '連線池的上限…只有 5？其他池都幾十個欸…', delay: 900 },
  { text: '只有尖峰時段炸，那就是排隊排到滿出來了吧…', delay: 2000 },
]

/** The model asking the player to choose — the AskUserQuestion tool. */
export const CHOICE_QUESTION = {
  header: '先修哪邊',
  question: '兩個地方都能改，ご主人様想先動哪一邊呢？',
  options: [
    { label: '連線池上限', description: '把長效 session 的上限對齊一般 API 池' },
    { label: '排隊逾時', description: '讓排太久的請求直接快速失敗，不要無限堆積' },
  ],
  multiSelect: false,
}

export const EXTRAS_QUESTION = {
  header: '順便做',
  question: '順便幫ご主人様做這些嗎？可以多選喔～',
  options: [
    { label: '補壓力測試', description: '模擬整點尖峰的登入洪峰' },
    { label: '加監控告警', description: '連線池使用率超過 80% 就提醒' },
    { label: '寫進交接簿', description: '把這次的來龍去脈記下來' },
  ],
  multiSelect: true,
}

export function choiceAckLine(picks: string[]) {
  if (picks.length === 0) return '好～那就先不加東西，ことね照原本的做喔！'
  return `收到！那就「${picks.join('、')}」，ことね記下來了☆`
}

export const TODO_STEPS = [
  '看連線池設定',
  '比對存取日誌',
  '改上限＋補快速失敗',
  '跑壓力測試',
]

export const HEAVY_WHISPERS = [
  { name: 'Read', label: '＊翻開了 config.json＊', delay: 500 },
  { name: 'Grep', label: '＊比對了存取日誌＊', delay: 1500 },
  { name: 'Bash', label: '＊跑了一次壓力測試＊', delay: 2500 },
]

/** Canned look snapshots — in the real adapter these come out of a model fed
 * with the actual session state (like the plugin's look-update.py). */
export const INITIAL_LOOK = {
  scene: 'ことね把圍裙帶子重新繫好，在吧台後站得直挺挺的，眼睛亮晶晶地等著單子。',
  dialogue: '今天也請多多指教嘛，ご主人様♪',
}

export const LOOK_HEAVY_WORKING = {
  scene: '身子往前傾，盯著螢幕那欄還在跳紅的型別錯誤，指尖在鍵盤上敲著停停敲敲。',
  dialogue: '咦…明明改對了啦…怎麼還在紅啦…',
}

export const LOOK_BY_TIER = {
  light: {
    scene: '答完問題的ことね轉著筆，朝這邊探頭探腦，一臉「還有嗎還有嗎」。',
    dialogue: '這種小問題，ことね秒答喔～',
  },
  medium: {
    scene: 'ことね把講解完的程式碼視窗留在螢幕上，手指還點在那一行捨不得移開。',
    dialogue: '講解得不錯吧？嘿嘿。',
  },
  heavy: {
    scene: 'ことね盯著終於全綠的測試結果，握拳的手在桌子底下偷偷揮了一下。',
    dialogue: '抓到了啦！就是連線池在搞鬼！',
  },
} as const
