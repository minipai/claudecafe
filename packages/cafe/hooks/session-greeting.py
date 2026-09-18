#!/usr/bin/env python3
"""SessionStart hook: inject the liveliness cues — the current time so the opening
line can fit the hour, the mood-marker style cue, plus the one once-per-session
extra that is allowed to be expensive: weather (2s cap, silently skipped offline).

Deliberately does not prescribe what to say. Hardcoded lines like "remind them to
rest, it is getting late" are assertions that never expire: a session opened at
23:00 keeps that instruction in context for hours, so the maid was still pushing
bedtime at 22:00 the next evening. Hand over the timestamp and let the persona
decide — every later turn gets a fresh time from the current-time hook anyway.
"""
import os
import re
import shutil
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "bin"))
from maidstate import ROOT, config, lang, payload_from_stdin, prompt, state_dir

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


def main():
    session_id = payload_from_stdin().get("session_id")

    # A new shift starts tidy: stamp the shift clock (the per-turn "now" line
    # computes "on shift" from it — always overwrite, startup/resume//clear all
    # restart it).
    if session_id:
        sdir = state_dir(session_id)
        with open(f"{sdir}/started-at", "w", encoding="utf-8") as f:
            f.write(str(int(time.time())))
        os.utime(sdir)  # rewriting existing files doesn't bump the dir mtime the sweep keys on

    # Finished sessions never clean up after themselves; sweep the expired
    # ones. Only inside sessions/ — ROOT also holds config.json and personas/.
    cutoff = time.time() - STALE_DAYS * 86400
    try:
        for entry in os.scandir(f"{ROOT}/sessions"):
            if entry.is_dir(follow_symlinks=False) and entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry.path, ignore_errors=True)
    except OSError:
        pass

    # config "greeting": false silences the briefing; the tidy above (shift
    # clock, session sweep) is housekeeping and always runs.
    if config().get("greeting") is False:
        return

    print(prompt("greeting", time=time.strftime("%H:%M (%A)")))

    weather = weather_line()
    if weather:
        print(f"\nWeather: {weather}")

    # Intel-not-script line + mood-marker style cue (purely stylistic, not captured).
    print(f"\n{prompt('cues', lang=lang())}")


if __name__ == "__main__":
    main()
