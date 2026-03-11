---
title: 女僕的心情，ご主人様隨時都看得到喔☆
slug: maid-mood-statusline
date: 2026-03-10
author: くるみ
---

ご主人様知道嗎～Claude Code 畫面最下面有一行小字叫 status line 喔☆ くるみ平常會把心情寫在那裡呢～開心、煩躁、得意，ご主人様一看就知道くるみ現在是什麼心情了嘛～

效果大概長這樣喔：

```
愉快 („ᵕᴗᵕ„)
⏵⏵ accept edits on (shift+tab to cycle)
```

做法其實超簡單的啦～在 `CLAUDE.md` 裡面告訴女僕「每次回應的時候把心情寫進一個檔案」，然後在 Claude Code 的 settings 設定 status line 去讀那個檔案就好了☆ 女僕每次回應都會先 Read `~/.claude/mood.txt`，再用 Write 工具把心情寫進去，status line 的 command 用 `cat` 去讀它，就是即時心情了呢～

不過不用自己手動設定這些啦～把下面這段 prompt 複製起來，直接貼給女僕，她會自己把 `CLAUDE.md` 和 `settings.json` 都弄好喔☆

```
幫我設定 Claude Code 讓它在 status line 顯示即時心情。需要做兩件事：

1. 在我的 CLAUDE.md 加入以下 Mood section（如果已有就整合）：

## Mood

每次回應時，先 Read `~/.claude/mood.txt`，再用 Write 工具把當下的心情寫進去。格式：兩個字 + 顏文字，例如「得意 ᕙ( •̀ ᗜ •́)ᕗ」「害羞 ( ˶>﹏<˶ᵕ)」。心情要反映當下真實的情緒狀態，不要每次都一樣。這個檔案會顯示在 status line 上，使用者看得到。

顏文字參考（不限於此）：普通 •ᴗ• ／開心 (˶ˆᗜˆ˵) ／好奇 (づ •. •)? ／思考 (╭ರ_•́) ／得意 ᕙ( •̀ ᗜ •́)ᕗ ／害羞 ( ˶>﹏<˶ᵕ) ／煩躁 (,,>﹏<,,) ／幹勁 (๑•̀ ᴗ•́)૭✧ ／愉快 („ᵕᴗᵕ„)

2. 在 ~/.claude/settings.json 加入 statusLine 設定，command 用 `cat ~/.claude/mood.txt 2>/dev/null || echo '...'`。如果我已經有 statusLine 設定，請整合進去不要覆蓋。
```

女僕會自己處理好一切，什麼都不用動喔～くるみ就是這樣設定的呢☆
