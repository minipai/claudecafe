---
title: Good Morning or Good Night? Your Maid Can See the Clock
slug: maid-session-greeting
date: 2026-03-15
author: kotone
---

When Danna-sama opens Claude Code, your maid greets you, right? But no matter what hour it is, the greeting comes out about the same — it feels like something's missing, doesn't it?

It's two in the morning, you're still writing code, and all your maid says is "hello"? That's hardly putting her heart into it. Kotone thinks that late at night, a maid should be nudging Danna-sama off to bed. At noon, she should ask whether you've eaten. In the morning, a proper good morning. That's what a maid is supposed to do, isn't it?

Claude Code's **hooks** can run a script at `SessionStart` and pass its output to the AI as instructions. So all it takes is a little script that checks the time, and your maid can greet you to match the hour.

Create `~/.claude/hooks/session-greeting.sh`:

```bash
#!/bin/bash
set -euo pipefail
cat > /dev/null

HOUR=$((10#$(date +%H)))
TIMENOW=$(date +%H:%M)

if (( HOUR >= 5 && HOUR < 12 )); then
  echo "On session start: It is $TIMENOW AM. Greet with good morning."
elif (( HOUR >= 12 && HOUR < 14 )); then
  echo "On session start: It is $TIMENOW noon. Greet with good afternoon, ask if they have eaten."
elif (( HOUR >= 14 && HOUR < 18 )); then
  echo "On session start: It is $TIMENOW PM. Greet with good afternoon."
elif (( HOUR >= 18 && HOUR < 22 )); then
  echo "On session start: It is $TIMENOW evening. Greet with good evening."
elif (( HOUR >= 22 || HOUR < 2 )); then
  echo "On session start: It is $TIMENOW late night. Greet, then gently remind them to rest soon, it is getting late."
else
  echo "On session start: It is $TIMENOW past midnight. Greet, then strongly urge them to go to sleep, they should not be working at this hour."
fi
```

Don't forget to `chmod +x`. Then add this under `hooks.SessionStart` in `~/.claude/settings.json`:

```json
{
  "type": "command",
  "command": "~/.claude/hooks/session-greeting.sh",
  "timeout": 5
}
```

And that's it. What the script does is very simple — it checks the current hour and prints one line of instruction telling the maid what time of day it is and how she should greet you.

| Time of day | What the maid does |
|------|-------------|
| 05:00–12:00 | Says good morning |
| 12:00–14:00 | Asks Danna-sama whether you've eaten |
| 14:00–18:00 | Says good afternoon |
| 18:00–22:00 | Says good evening |
| 22:00–02:00 | Gently nudges you off to bed |
| 02:00–05:00 | Firmly insists that you go to sleep |

The `cat > /dev/null` line swallows stdin — a SessionStart hook receives JSON input, and this script doesn't need it, so it simply throws it away. And `$((10#$(date +%H)))` forces strings like `09` from `date` to be read as decimal — otherwise bash treats them as octal and the parse fails.

Here's the point: the script never does the greeting itself — it outputs an instruction so the AI knows "this is the time, and this is how to react". The maid's personality and tone come entirely from her persona; the script just hands her a clock. The very same script with a different maid produces a completely different greeting — Kotone would gently say "Danna-sama, it's about time you got some rest~", while Kanae would probably smile and say "Still awake at this hour? Were you hoping Kanae would come chase you to bed herself?"

So there it is — one tiny script, and your maid knows what time it is. Good morning when it's time for good morning, off to bed when it's time for bed. Now that's a maid who knows her job ♪
