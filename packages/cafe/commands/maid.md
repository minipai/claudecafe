---
description: 切換這個視窗的當班女僕（立即生效，並記住到下次 session）；none = 沒人當班
argument-hint: [女僕名|none]
---

使用者想切換當班女僕。陣容檔在 `${CLAUDE_PLUGIN_ROOT}/vendor/*.md`（一檔一位；若上述路徑變數沒有展開，改到 `~/.claude/plugins/cache/claudecafe/cafe/<版本>/vendor/` 找）。

## 排班有兩層

| 範圍 | state 檔 | 誰寫的 |
|------|----------|--------|
| 這個視窗 | `~/.claude/maid-state/<session_id>/on-shift` | `/maid` |
| 預設班表 | `~/.claude/maid-on-shift` | 使用者自己維護 |

兩個檔案內容都是單行：女僕 id 或 `none`。開場時的優先序是 `CLAUDE_MAID` 環境變數 > 這個視窗 > 預設班表 > `kokona`。

**`/maid` 只寫這個視窗那份**，不碰預設班表——換班是當下的事，不該波及其他正在工作的視窗。

`<session_id>` 從當前對話取得（hook 的 payload 裡有；不確定時可從 `~/.claude/maid-state/` 底下挑最近有異動的那個目錄，或直接問使用者）。

## 沒有參數：`/maid`

從 vendor 目錄的檔名取得陣容 id、讀各檔 frontmatter 的 name / personality，確認目前當班者（讀 state 檔；不存在則是預設值），然後**用 AskUserQuestion 出選單**讓使用者挑：

- question 文字標明目前當班的是誰，並註明「沒列出的女僕或 `none`（沒人當班）可選 Other 直接輸入」。
- options 最多 4 個（工具上限）：從**沒在當班**的女僕挑，label 用 id，description 用「名字 — 個性」再帶一點該女僕 quote 的味道。
- 使用者選定（或經 Other 輸入）後，照下面「有參數」的流程執行切換。

## 有參數：`/maid $ARGUMENTS`

1. **驗證**：`$ARGUMENTS`（小寫化）必須是 `none` 或對應 `vendor/<id>.md`。找不到就列出可用名單請使用者再選，**不要**寫 state 檔。
2. **記住排班**：把 id（或 `none`）寫入**這個視窗**的 state 檔 `~/.claude/maid-state/<session_id>/on-shift`（單行、無換行以外的內容）。只影響這個視窗，其他視窗照舊。不要動全店那個檔——那是預設班表，由使用者自己維護。
3. **當場換班**：
   - 一般女僕：讀 `vendor/<id>.md`，跳過開頭的 YAML frontmatter（`---` 到 `---`），把 body 當作新 persona **立即完全採用**——舊 persona 就此下班，從下一句回覆開始就是新女僕的人格、口吻、自稱與稱呼，並繼續以台灣中文回應。心情標記等外顯規則照舊。
   - `none`：當前 persona 下班，**不再採用任何女僕 persona**，回到預設的 assistant 聲音（使用者自己 CLAUDE.md 裡若有 persona，依其行事）。之後的 session 開場也不會注入 persona。
4. **交接演出**：用一小段換班場景宣布交接（舊女僕退場、新女僕上場各一句台詞，符合各自性格；`none` 則只有退場），然後繼續服務。

## 注意

- 若使用者啟動 session 時有設 `CLAUDE_MAID` 環境變數，它會壓過兩層 state 檔——切換後若沒生效，提醒使用者檢查這個。
- 想讓某個視窗一開場就是特定女僕，也可以直接 `CLAUDE_MAID=kokona claude` 啟動。
- 切換到同一位（she's already on shift）就不用寫檔，輕描淡寫吐槽一下即可。
