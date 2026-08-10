#!/usr/bin/env python3
"""SessionStart hook: inject the liveliness cues — the current time so the opening
line can fit the hour, the mood-marker style cue, plus the once-per-session extras
that are allowed to be expensive: weather (2s cap, silently skipped offline) and
the shared diary's recent entries (the memory feel).

Deliberately does not prescribe what to say. Hardcoded lines like "remind them to
rest, it is getting late" are assertions that never expire: a session opened at
23:00 keeps that instruction in context for hours, so the maid was still pushing
bedtime at 22:00 the next evening. Hand over the timestamp and let the persona
decide — every later turn gets a fresh time from the current-time hook anyway.
"""
import datetime
import os
import re
import shutil
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "bin"))
from maidstate import (DIARY, ROOT, config, lang, payload_from_stdin, prompt,
                       read, state_dir)

STALE_DAYS = 7

WEATHER_FORMAT = "%l｜%c%t (feels %f)｜sunrise %S, sunset %s"


def weather_line():
    """One wttr.in call, IP-located, hard 2s cap. A missing line is fine;
    a stalled session start is not."""
    url = "https://wttr.in/?format=" + urllib.parse.quote(WEATHER_FORMAT)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            text = resp.read().decode("utf-8", errors="replace").strip()
    except Exception:
        return None
    if not text or "\n" in text:  # error pages are multi-line; the format line never is
        return None
    return re.sub(r"(\d\d:\d\d):\d\d", r"\1", text)  # drop seconds from sunrise/sunset


def humanize_gap(seconds):
    if seconds >= 172800:
        return f"last one {seconds // 86400} days ago"
    if seconds >= 7200:
        return f"last one {seconds // 3600} hours ago"
    if seconds >= 60:
        return f"last one {seconds // 60} minutes ago"
    return "last one just now"


def diary_tail():
    entries = read(DIARY).strip().splitlines()
    if not entries:
        return None
    ago = "time unknown"
    try:
        last = datetime.datetime.strptime(entries[-1].split("｜")[0], "%Y-%m-%d %H:%M")
        ago = humanize_gap(int(time.time() - last.timestamp()))
    except ValueError:
        pass
    return f"Recent handover-diary entries ({ago}):\n" + "\n".join(entries[-3:])


def main():
    if os.environ.get("CLAUDE_MAID_SUB"):
        return  # background look/diary sub-sessions: skip weather, diary, sweep
    session_id = payload_from_stdin().get("session_id")

    # A new shift starts tidy: stamp the shift clock (the per-turn "now" line
    # computes "on shift" from it — always overwrite, startup/resume//clear all
    # restart it) and drop the previous look/mood, so the status bar shows a
    # fresh clock-in rather than last shift's scene until the first re-shoot.
    if session_id:
        sdir = state_dir(session_id)
        with open(f"{sdir}/started-at", "w", encoding="utf-8") as f:
            f.write(str(int(time.time())))
        for name in ("look.txt", "look.ctx", "look.lock"):
            try:
                os.unlink(f"{sdir}/{name}")
            except OSError:
                pass
        os.utime(sdir)  # rewriting existing files doesn't bump the dir mtime the sweep keys on

    # Finished sessions never clean up after themselves; sweep the expired
    # ones. Only inside sessions/ — ROOT also holds personas/, diary.md, bin.
    cutoff = time.time() - STALE_DAYS * 86400
    try:
        for entry in os.scandir(f"{ROOT}/sessions"):
            if entry.is_dir(follow_symlinks=False) and entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry.path, ignore_errors=True)
    except OSError:
        pass

    # config "greeting": false silences the briefing; the tidy above (shift
    # clock, look cleanup, session sweep) is housekeeping and always runs.
    if config().get("greeting") is False:
        return

    print(prompt("greeting", time=time.strftime("%H:%M (%A)")))

    weather = weather_line()
    if weather:
        print(f"\nWeather: {weather}")

    diary = diary_tail()
    if diary:
        print(f"\n{diary}")

    # Intel-not-script line + mood-marker style cue (purely stylistic, not captured).
    print(f"\n{prompt('cues', lang=lang())}")


if __name__ == "__main__":
    main()
