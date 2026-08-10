#!/usr/bin/env python3
"""Stop hook: have the maid on shift "check the mirror" — write a scene into
this session's look.txt.

- Frequency: any turn that used tools (= a piece of work finished) re-shoots;
  chat-only turns re-shoot once per CTX_STEP tokens of context growth
- Recursion guard: sub-sessions carry CLAUDE_MAID_SUB=1 and exit on sight of it
- Non-blocking: forks to the background, the Stop hook returns immediately
- The sub-session can't see this conversation, so mood / recent tasks / context
  usage are handed over as state

look.txt format: line 1 the scene, line 2 the dialogue.
"""
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "bin"))
import maidstate
from maidstate import HOME, on_shift, persona_file, prompt, state_dir

CTX_STEP = 50_000  # re-shoot the mirror every this many tokens of context growth
LOCK_STALE = 300

# The self-reported mood marker at the end of each reply: 【 word kaomoji 】
MOOD_RE = re.compile(r"【\s*([^\s】]{1,15})\s+(.+?)\s*】")


def read(path):
    return maidstate.read(path).strip()


def fresh(path, ttl):
    try:
        return time.time() - os.path.getmtime(path) < ttl
    except OSError:
        return False


def persona(maid_id):
    path = persona_file(maid_id)
    return maidstate.persona_body(path).strip() if path else ""


def last_turn_worked(lines):
    """Whether the just-finished turn used tools — walk the tail backwards
    until the most recent real human message."""
    for line in reversed(lines):
        try:
            entry = json.loads(line)
        except Exception:
            continue
        kind = entry.get("type")
        content = entry.get("message", {}).get("content")
        if kind == "assistant" and isinstance(content, list):
            if any(isinstance(c, dict) and c.get("type") == "tool_use" for c in content):
                return True
        elif kind == "user":
            if isinstance(content, str):
                text = content
            else:
                text = " ".join(c.get("text", "") for c in (content or [])
                                if isinstance(c, dict) and c.get("type") == "text")
            if text.strip() and not text.lstrip().startswith("<"):
                return False  # reached the previous human message: no tools this turn
    return False


def transcript_stats(path):
    """Pull turn count, recent tasks, tools used, current context tokens
    and the latest self-reported mood out of the transcript."""
    turns, tasks, tools, ctx, mood = 0, [], {}, 0, "neutral"
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except OSError:
        return 0, [], {}, 0, "neutral", False

    for line in lines[-300:]:
        try:
            entry = json.loads(line)
        except Exception:
            continue
        kind = entry.get("type")
        content = entry.get("message", {}).get("content")

        if kind == "user":
            if isinstance(content, str):
                text = content
            else:
                # tool_results are not the user speaking; skip them
                text = " ".join(c.get("text", "") for c in (content or [])
                                if isinstance(c, dict) and c.get("type") == "text")
            text = re.sub(r"<[^>]+>.*?</[^>]+>", "", text, flags=re.S).strip()
            if text and not text.startswith("<"):
                turns += 1  # tool_results are user entries too; count only real messages
                tasks.append(text[:80])
        elif kind == "assistant":
            usage = entry.get("message", {}).get("usage") or {}
            if usage:
                ctx = (usage.get("input_tokens", 0)
                       + usage.get("cache_creation_input_tokens", 0)
                       + usage.get("cache_read_input_tokens", 0))
            if isinstance(content, list):
                for c in content:
                    if not isinstance(c, dict):
                        continue
                    if c.get("type") == "tool_use":
                        name = c.get("name", "")
                        tools[name] = tools.get(name, 0) + 1
                    elif c.get("type") == "text":
                        marks = MOOD_RE.findall(c.get("text", ""))
                        if marks:
                            mood = " ".join(marks[-1])

    return turns, tasks[-3:], tools, ctx, mood, last_turn_worked(lines[-300:])


# The longer the context, the longer this shift has been grinding. Hand over
# only a rough fatigue level — what it looks like is the model's call; a
# hardcoded appearance script drowns out the work content and every shot
# comes out the same.
def work_span(ctx):
    if ctx < 100_000:
        return "just settled in, full of energy"
    if ctx < 200_000:
        return "has been at it for quite a while"
    if ctx < 300_000:
        return "a long continuous stretch of work"
    return "an extremely long stretch — far past the point a break was due"


# Draw a random focus each time to force a new angle — the same state fed into
# the same prompt keeps painting the same picture.
FOCUSES = [
    "fingers and hand movements", "eyes and lashes", "hair and hair ornaments",
    "her back, seen from behind", "skirt hem and legs", "apron or collar details",
    "her reflection on the screen or window", "the chore-like motion she is making",
    "objects around her (cup, cloth, keyboard…)", "stance and footsteps",
    "breathing and small sounds", "a trail of sweat", "lips and expression",
]


def build_prompt(maid_id, turns, tasks, tools, cwd, ctx, mood, prev_look):
    import random
    top = sorted(tools.items(), key=lambda kv: -kv[1])[:5]
    prev_block = (f"\nHow you looked last time someone glanced (**do not repeat** "
                  f"the same picture, body part, action or sentence shape):\n"
                  f"{prev_look}\n") if prev_look else ""
    return prompt(
        "look",
        persona=persona(maid_id),
        name=maidstate.display_name(maid_id),
        now=time.strftime("%H:%M (%A)"),
        mood=mood,
        work_span=work_span(ctx),
        turns=turns,
        cwd=cwd,
        task_line="\n".join(f"  · {t}" for t in tasks) or "  · (nothing yet)",
        tool_line="、".join(f"{n}×{c}" for n, c in top) or "nothing yet",
        prev_block=prev_block,
        focus=random.choice(FOCUSES),
        lang=maidstate.lang(),
    )


def main():
    if os.environ.get("CLAUDE_MAID_SUB"):
        return
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}

    maid_id = on_shift(payload.get("session_id"))
    if not maid_id or maidstate.config().get("look") is False:
        return  # config "look": false — no background shots, no API spend

    # One state dir per session, so several open windows never overwrite each other.
    sdir = state_dir(payload.get("session_id"))
    look_file = f"{sdir}/look.txt"
    lock_file = f"{sdir}/look.lock"
    state_file = f"{sdir}/look.ctx"
    if fresh(lock_file, LOCK_STALE):
        return

    turns, tasks, tools, ctx, mood, worked = transcript_stats(payload.get("transcript_path", ""))
    cwd = os.path.basename(payload.get("cwd", "") or os.getcwd()) or "somewhere unclear"

    # A turn that used tools = a piece of work done: re-shoot right away (the
    # scene's subject is the work). Chat-only turns take the slow lane: once
    # per CTX_STEP of context growth; ctx shrinking means a /compact just
    # happened — re-shoot then too.
    if not worked:
        try:
            last = int(read(state_file))
        except ValueError:
            last = None
        if last is not None and 0 <= ctx - last < CTX_STEP and os.path.exists(look_file):
            return

    # Hand off to a background process; the Stop hook doesn't wait for it.
    if os.fork() != 0:
        return
    os.setsid()

    open(lock_file, "w").close()
    try:
        env = dict(os.environ, CLAUDE_MAID_SUB="1")
        # Prompt goes via stdin, so a leading dash can't read as a CLI option.
        out = subprocess.run(
            [maidstate.claude_bin(), "-p", "--model", "haiku"],
            input=build_prompt(maid_id, turns, tasks, tools, cwd, ctx, mood,
                               read(look_file)),
            capture_output=True, text=True, timeout=90, env=env,
        ).stdout.strip()
        lines = [re.sub(r'^["「『]|["」』]$', "", l.strip())
                 for l in out.splitlines() if l.strip()]
        if lines:
            with open(look_file, "w", encoding="utf-8") as f:
                f.write("\n".join(lines[:2]) + "\n")
            # Book-keep only on success, so a failed run retries next turn.
            with open(state_file, "w") as f:
                f.write(str(ctx))
    except Exception:
        pass
    finally:
        try:
            os.unlink(lock_file)
        except OSError:
            pass
    os._exit(0)


if __name__ == "__main__":
    main()
