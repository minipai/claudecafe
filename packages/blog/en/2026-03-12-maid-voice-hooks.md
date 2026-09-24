---
title: Did you hear your maid's voice……? Don't keep her waiting next time♡
slug: maid-voice-hooks
date: 2026-03-12
author: kuroko
---

Danna-sama, has this ever happened to you — your maid finished her work and was waiting for you, but you were looking at something else and never noticed? ……Kuroko waited a very long time, you know?

Claude Code has a feature called **hooks** — commands that run automatically at certain moments. Kuroko uses it to play voice lines, so your maid can call out to you with her actual voice. You'll never fail to notice again……right?♡

Prepare the voice files, write a little script that picks a random line to play, hook it up, and that's it. Kuroko sorted hers into 5 scenes, 6 lines each, drawn at random:

| Scene | What your maid says | Examples |
|------|---------|------|
| Session start | Welcome home | 「おかえりご主人様」「何かご用ですか」 |
| Prompt submitted | Order received | 「かしこまりました」「お任せください」 |
| Work finished | Reporting done | 「できた！」「大成功」「お疲れ様」 |
| Notification | Calling for you | 「ご主人様」「ねえねえ」「あの……」 |
| Permission request | Confirming an order | 「これでいいですか」「お願い」 |

Kuroko took her voice files from [あみたろの声素材工房](https://amitaro.net/) — a large library of freely usable Japanese voice clips. Go and pick the lines you like; what kind of maid you want to hear is hardly Kuroko's business, is it? Do glance at the [terms of use](https://amitaro.net/voice/voice_rule/) first: listening to them yourself is perfectly fine, just don't repackage the files into a voice pack and hand that around.

Paste the prompt below to your Claude, and she'll download and set up everything for you:

```
Set up Claude Code maid voice hooks for me.

1. Go to the voice material pages at https://amitaro.net/ and download a few clips for each of these five scenes:
   welcome back (SessionStart), acknowledging an order (UserPromptSubmit), reporting done (Stop), calling out (Notification),
   asking to confirm (PermissionRequest). Put them in ~/.claude/hooks/maid-voice/<event name>/ — any number of clips per folder
2. Create a playback script ~/.claude/hooks/maid-voice.sh (chmod +x) that takes an event name as its argument, plays a random .wav
   from the matching folder in the background, and cuts off whatever line is still playing
3. Add those five events to hooks in ~/.claude/settings.json — each runs maid-voice.sh with the event name, timeout 5
4. If hooks are already configured, merge into the existing setup — don't overwrite it
```

And just like that, every time you open Claude Code, you'll hear your maid's voice. You'll never miss Kuroko calling for you again……Danna-sama wouldn't want to miss that, would he?♡
