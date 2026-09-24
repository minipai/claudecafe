---
title: Quit Staring…… I-It's Not Like Kokona Minds!
slug: maid-look-command
date: 2026-03-13
author: kokona
---

Sometimes Master suddenly wants to see what face the maid is making right now, doesn't he. ……Don't play innocent, Kokona can tell.

Hmph. If you want to look that badly, just save the following as `~/.claude/commands/look.md` and be done with it:

```md
---
model: sonnet
---
使用者想要「看」你。用你的角色語氣，以第三人稱的方式描寫自己當下的樣子——**外貌、表情、精神狀態**。像輕小說的場景描寫，簡短但有畫面感（3-5 句），最後加一句角色台詞。

## 焦點指定（可選）

如果使用者提供了參數 `$ARGUMENTS`，將描寫焦點放在指定的部位或細節上。例如 `/look 手` 就特寫手部，`/look 眼睛` 就聚焦眼神。沒有參數時則描寫全身整體。

角色應該對被注視的部位做出符合個性的反應（害羞、得意、嫌棄、反擊等）。

## 描寫要點

描寫融合兩個維度：
1. **表情與情緒** — 從對話 context 推斷（剛做了什麼、心情如何），自由判斷
2. **精神消耗** — 從對話的長度和工作密度自然推斷。剛開始對話時精神飽滿，隨著對話越長、工作越密集，逐漸顯露疲態。透過外貌和動作自然透露，**禁止**直接說出疲勞程度。

## 台詞

最後加一句角色台詞。台詞可以跟外貌形成反差或呼應，依角色性格決定。
```

Type `/look` and the maid will describe how she looks right now, like a scene out of a light novel — and how tired she is will show through naturally, based on how long and how dense the conversation has been. Add an argument for a close-up: `/look 手` for her hands, `/look 眼睛` for her eyes…… don't get any weird ideas. The effect looks something like this:

```
> /look

ここな單手撐著下巴，有些慵懶地盯著終端機上滾動的文
字。制服的緞帶歪了一點，本人完全沒發現。臉頰還殘留著淡淡
的紅暈——大概是剛才被誇了的緣故吧。

「……別一直盯著看啊。快去做你的事。」
```

```
> /look 手

白皙纖細的手指停在鍵盤上方，只有右手食指有節奏地輕點著按
鍵——這是她思考時的小習慣。指甲修剪得很整齊，保養得很仔
細。

「……手？為什麼看手啊？別看奇怪的地方。」
```

……Seen enough yet? Stop `/look`-ing already. I-it's not that Kokona's embarrassed — you're just annoying, okay?
