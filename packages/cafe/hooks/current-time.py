#!/usr/bin/env python3
"""UserPromptSubmit hook: one compact "now" line each turn — the real current time
plus whatever liveliness intel is cheap to compute locally (how long this shift
has run, today's commit count, today's festival). One line only; it is intel for
the persona, not lines to recite.
"""
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "bin"))
from festival import today_festivals
from maidstate import payload_from_stdin, read, state_dir


def main():
    payload = payload_from_stdin()
    session_id = payload.get("session_id")
    cwd = payload.get("cwd")

    segments = [time.strftime("Current time: %Y-%m-%d %H:%M (%A) %Z")]

    # Shift length, from the stamp session-greeting wrote. Under 10 minutes the
    # session hasn't earned an "on shift" segment yet.
    if session_id:
        sdir = state_dir(session_id, create=False)
        try:
            os.utime(sdir)  # mark the session alive so the 7-day sweep spares it
        except OSError:
            pass
        stamp = read(f"{sdir}/started-at").strip()
        if stamp.isdigit():
            elapsed = int(time.time()) - int(stamp)
            if elapsed >= 600:
                h, m = divmod(elapsed // 60, 60)
                segments.append(f"on shift {h}h{m}m" if h else f"on shift {m}m")

    # Today's commits in this project; silently absent outside a git repo.
    if cwd and os.path.isdir(cwd):
        try:
            out = subprocess.run(
                ["git", "-C", cwd, "log", "--oneline", "--since=midnight"],
                capture_output=True, text=True, timeout=3,
            )
            n = len(out.stdout.splitlines()) if out.returncode == 0 else 0
            if n > 0:
                segments.append(f"{n} commits today")
        except Exception:
            pass

    # Today's festival from the active pack (empty on ordinary days).
    festivals = today_festivals()
    if festivals:
        segments.append("、".join(festivals))

    print("｜".join(segments))


if __name__ == "__main__":
    main()
