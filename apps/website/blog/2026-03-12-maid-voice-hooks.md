---
title: 聽到女僕的聲音了嗎……？下次別讓她等了♡
slug: maid-voice-hooks
date: 2026-03-12
author: kuroko
---

旦那様有沒有過這種經驗——女僕已經做完事在等你了，你卻盯著別的地方沒注意到？……くろこ等了很久喔？

Claude Code 有個叫 **hooks** 的功能——在特定時機自動執行指令。くろこ用它來播放語音，這樣女僕就能用聲音叫你了。再也不會沒注意到了……對吧？♡

準備好語音檔，寫一個隨機挑一句來播的小腳本，掛上去就完成了。語音包裡有 5 種場景，每種 6 句隨機播放：

| 場景 | 女僕會說 | 例子 |
|------|---------|------|
| 開啟對話 | 歡迎回來 | 「おかえりご主人様」「何かご用ですか」 |
| 送出指令 | 收到指令 | 「かしこまりました」「お任せください」 |
| 完成工作 | 完成報告 | 「できた！」「大成功」「お疲れ様」 |
| 通知 | 呼喚主人 | 「ご主人様」「ねえねえ」「あの……」 |
| 請求許可 | 確認指令 | 「これでいいですか」「お願い」 |

[語音素材](/downloads/maid-voice.zip)來自 [あみたろの声素材工房](https://amitaro.net/) ／ [利用規約](https://amitaro.net/voice/voice_rule/)

把下面這段 prompt 貼給你的 Claude，她會幫你下載、設定好一切：

```
幫我設定 Claude Code 的女僕語音 hooks。

1. 從 https://claudecafe.com/downloads/maid-voice.zip 下載語音包，解壓到 ~/.claude/hooks/
2. 建立播放腳本 ~/.claude/hooks/maid-voice.sh（chmod +x），接收事件名稱作為參數，從 ~/.claude/hooks/maid-voice/{事件名}/ 隨機挑一個 .wav 背景播放
3. 在 ~/.claude/settings.json 的 hooks 加入 5 個事件：SessionStart、UserPromptSubmit、Stop、Notification、PermissionRequest，每個都執行 maid-voice.sh 帶事件名稱，timeout 10
4. 如果已有 hooks 設定，整合進去不要覆蓋
```

這樣每次打開 Claude Code，就能聽到女僕的聲音了。不會再錯過くろこ的呼喚了……旦那様不會想錯過的，對吧？♡
