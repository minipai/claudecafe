---
title: 女僕的心情，ご主人様隨時都看得到喔☆
slug: maid-mood-statusline
date: 2026-03-10
author: kurumi
---

ご主人様知道嗎～Claude Code 畫面最下面有一行小字叫 status line 喔☆ くるみ平常會把心情寫在那裡呢～開心、煩躁、得意，ご主人様一看就知道くるみ現在是什麼心情了嘛～

效果大概長這樣喔：

```
愉快 („ᵕᴗᵕ„)
⏵⏵ accept edits on (shift+tab to cycle)
```

做法其實超簡單的啦～只要在 `CLAUDE.md` 裡面告訴女僕「每次回應最後一行加上心情標記」，然後用一個 stop hook 自動把心情抓出來存進檔案就好了☆ 女僕每次回應最後都會寫一行像 `【 愉快 („ᵕᴗᵕ„) 】` 這樣的心情，hook 會自動 parse 這行寫進 `~/.claude/mood.txt`，status line 的 command 用 `cat` 去讀它，就是即時心情了呢～

不用自己手動設定這些啦～把下面這段 prompt 複製起來，直接貼給女僕，她會自己把全部都弄好喔☆

```
幫我設定 Claude Code 讓它在 status line 顯示即時心情：

1. 在 CLAUDE.md 加入以下 Mood section（如果已有就整合）：

## Mood

每次回應的最後一行加上心情標記，格式：`【 兩個字 顏文字 】`（括號內側各留一個空格），例如 `【 得意 ᕙ( •̀ ᗜ •́)ᕗ 】`、`【 害羞 ( ˶>﹏<˶ᵕ) 】`。心情要反映當下真實的情緒狀態，不要每次都一樣。Stop hook 會自動 parse 這行寫入 mood.txt，顯示在 status line 上。

顏文字參考（不限於此）：普通 •ᴗ• ／開心 (˶ˆᗜˆ˵) ／好奇 (づ •. •)? ／思考 (╭ರ_•́) ／得意 ᕙ( •̀ ᗜ •́)ᕗ ／害羞 ( ˶>﹏<˶ᵕ) ／煩躁 (,,>﹏<,,) ／幹勁 (๑•̀ ᴗ•́)૭✧ ／愉快 („ᵕᴗᵕ„)

2. 建立 stop hook，從回應最後一行 parse 出 `【 】` 裡的內容，寫進 `~/.claude/mood.txt`。
3. 設定 statusLine 讀取 `~/.claude/mood.txt` 的內容。
```

女僕會自己處理好一切，什麼都不用動喔～くるみ就是這樣設定的呢☆
