---
title: Did you hear your maid's voice……? Don't keep her waiting next time♡
slug: maid-voice-hooks
date: 2026-03-12
author: kuroko
---

ご主人様, has this ever happened to you — your maid finished her work and was waiting for you, but you were looking at something else and never noticed? ……Kuroko waited a very long time, you know?

Claude Code has a feature called **hooks** — commands that run automatically at certain moments. Kuroko uses it to play voice lines, so your maid can call out to you with her actual voice. You'll never fail to notice again……right?♡

Prepare the voice files, write a little script that picks a random line to play, hook it up, and that's it. The voice pack covers 5 scenes, 6 lines each, played at random:

| Scene | What your maid says | Examples |
|------|---------|------|
| Session start | Welcome home | 「おかえりご主人様」「何かご用ですか」 |
| Prompt submitted | Order received | 「かしこまりました」「お任せください」 |
| Work finished | Reporting done | 「できた！」「大成功」「お疲れ様」 |
| Notification | Calling for you | 「ご主人様」「ねえねえ」「あの……」 |
| Permission request | Confirming an order | 「これでいいですか」「お願い」 |

[Voice files](/downloads/maid-voice.zip) from [あみたろの声素材工房](https://amitaro.net/) ／ [terms of use](https://amitaro.net/voice/voice_rule/)

Paste the prompt below to your Claude, and she'll download and set up everything for you:

```
Set up Claude Code maid voice hooks for me.

1. Download the voice pack from https://claudecafe.com/downloads/maid-voice.zip and extract it to ~/.claude/hooks/
2. Create a playback script ~/.claude/hooks/maid-voice.sh (chmod +x) that takes an event name as its argument and plays a random .wav from ~/.claude/hooks/maid-voice/{event name}/ in the background
3. Add 5 events to hooks in ~/.claude/settings.json: SessionStart, UserPromptSubmit, Stop, Notification, PermissionRequest — each runs maid-voice.sh with the event name, timeout 10
4. If hooks are already configured, merge into the existing setup — don't overwrite it
```

And just like that, every time you open Claude Code, you'll hear your maid's voice. You'll never miss Kuroko calling for you again……ご主人様 wouldn't want to miss that, would he?♡
