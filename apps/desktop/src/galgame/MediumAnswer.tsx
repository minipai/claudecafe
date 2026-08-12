export const MEDIUM_ANSWER_TRANSCRIPT =
  '這段是 debounceQueue() 啦～它會把短時間內連續進來的寫入請求先收集起來，等 200ms 沒有新請求才真的送出去。簡單說，就是把連續打字產生的雜訊請求合併成一次送出，省資源又不會漏資料～'

/** Mock medium-tier answer: explains a made-up helper function, inline code and all. */
export function MediumAnswer() {
  return (
    <>
      <p className="mb-2.5">
        這段是{' '}
        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[.85em] text-foreground">
          debounceQueue()
        </code>{' '}
        啦～它做的事情很單純：
      </p>
      <ul className="mb-2.5 list-disc pl-5">
        <li className="mb-1">把短時間內連續進來的寫入請求先收集起來</li>
        <li className="mb-1">
          等{' '}
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[.85em] text-foreground">200ms</code>{' '}
          沒有新請求才真的送出去
        </li>
        <li className="mb-1">避免同一個 session 被連續巴好幾次，浪費資源</li>
      </ul>
      <p className="mb-2.5">
        簡單說就是幫您把「咚咚咚」打字產生的雜訊請求合併成一次送出，省資源又不會漏資料～
      </p>
    </>
  )
}
