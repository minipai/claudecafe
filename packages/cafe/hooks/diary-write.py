#!/usr/bin/env python3
"""SessionEnd hook: the maid on shift leaves one line in the handover diary.

The writing is done by a background-spawned `claude -p` (cheap model, detached,
never blocks session teardown), so the line is genuinely in her voice rather
than a template sentence. If spawning fails, fall back to a mechanical line —
the diary never skips a day.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "bin"))
from maidstate import DIARY, claude_bin, lang, on_shift, prompt, read

CLAUDE = claude_bin()
MAX_ENTRIES = 200
FALLBACK = "(closed up safely — nothing written tonight)"

# User entries that aren't human speech (hook injections, command echoes) start
# with a tag or a system marker.
NOISE_RE = re.compile(r"^\s*(<|\[Request interrupted|Caveat:)")


def digest_from_transcript(path):
    """Collect the last few turns of real conversation as material; None when
    no human ever spoke (a junk session)."""
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            f.seek(max(0, f.tell() - 512 * 1024))
            # Read only the last 512KB — a long session's transcript can reach
            # tens of MB. The first line is likely a truncated half-line;
            # json.loads fails on it and it gets skipped naturally.
            lines = f.read().decode("utf-8", errors="replace").splitlines()
    except OSError:
        return None
    turns = []
    human_seen = False
    for line in lines[-120:]:
        try:
            entry = json.loads(line)
        except Exception:
            continue
        kind = entry.get("type")
        if kind not in ("user", "assistant"):
            continue
        content = entry.get("message", {}).get("content")
        if isinstance(content, str):
            texts = [content]
        elif isinstance(content, list):
            texts = [c.get("text", "") for c in content
                     if isinstance(c, dict) and c.get("type") == "text"]
        else:
            continue
        text = " ".join(t.strip() for t in texts if t.strip())
        if not text or NOISE_RE.match(text):
            continue
        if kind == "user":
            human_seen = True
        speaker = "Master" if kind == "user" else "Maid"
        turns.append(f"{speaker}: {text[:300]}")
    if not human_seen:
        return None
    joined = "\n".join(turns)
    return joined[-4000:] if joined else None


def append_line(text):
    os.makedirs(os.path.dirname(DIARY), exist_ok=True)
    existing = read(DIARY).splitlines()
    existing.append(text)
    with open(DIARY, "w", encoding="utf-8") as f:
        f.write("\n".join(existing[-MAX_ENTRIES:]) + "\n")


def main():
    # Neither our own diary agent nor the mirror-check sub-session should
    # write another entry.
    if os.environ.get("CLAUDE_MAID_SUB") or os.environ.get("CLAUDE_MAID_DIARY"):
        return
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    transcript = payload.get("transcript_path")
    if not transcript or not os.path.exists(transcript):
        return
    maid = on_shift(payload.get("session_id"))
    if not maid:
        return  # nobody on shift, nobody to write
    digest = digest_from_transcript(transcript)
    if not digest:
        return

    stamp = time.strftime("%Y-%m-%d %H:%M")
    prefix = f"{stamp}｜{maid}｜"

    if not os.path.exists(CLAUDE):
        append_line(prefix + FALLBACK)
        return

    fd, prompt_file = tempfile.mkstemp(prefix="maid-diary-", suffix=".txt")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(prompt("diary", maid=maid, digest=digest, lang=lang()))

    # Detached: run claude -p over the prompt file, append the first line to
    # the diary; pad with the mechanical line on failure. The prefix rides in
    # an env var — the maid id is user-controlled text and must never be
    # spliced into bash source.
    script = f"""
out="$("{CLAUDE}" -p --model haiku < "{prompt_file}" 2>/dev/null | head -1)"
[ -n "$out" ] || out={json.dumps(FALLBACK, ensure_ascii=False)}
printf '%s%s\\n' "$DIARY_PREFIX" "$out" >> "{DIARY}"
tail -{MAX_ENTRIES} "{DIARY}" > "{DIARY}.tmp" && mv "{DIARY}.tmp" "{DIARY}"
rm -f "{prompt_file}"
"""
    env = dict(os.environ, CLAUDE_MAID_SUB="1", CLAUDE_MAID_DIARY="1",
               CLAUDE_MAID="none", DIARY_PREFIX=prefix)
    env.pop("CLAUDE_CODE_CHILD_SESSION", None)
    os.makedirs(os.path.dirname(DIARY), exist_ok=True)
    subprocess.Popen(
        ["/bin/bash", "-c", script], env=env, start_new_session=True,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


if __name__ == "__main__":
    main()
