#!/usr/bin/env python3
"""SessionStart hook: put a maid "on shift".

Injects the chosen persona's body (frontmatter stripped) plus the reply
language. The draw pool is the user's own personas_dir plus the bundled
vendor/ cast (drop the bundled ones wholesale with config
{"builtin_cast": false}); a user file with the same id overrides the bundled
one, and a persona whose frontmatter says off_duty: true sits out the draw —
so retiring one bundled maid is a tiny same-id override stub. Shift order:
CLAUDE_MAID env (one-shot override) > this session's own shift file (the
persisted draw, which is what lets two windows run different maids at once) >
config "maid" (a fixed pick — an explicit pick works even off duty) > a draw
from the pool. "none" = nobody on shift (no persona injected — for users who
bring their own persona via CLAUDE.md).
"""
import glob
import os
import random
import re
import sys

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "bin"))
from maidstate import (PLUGIN_ROOT, config, lang, payload_from_stdin,
                       persona_body, persona_file, personas_dir, read, state_dir)

OFF_DUTY_RE = re.compile(r"^off_duty:\s*(?:true|yes)\b", re.M | re.I)


def off_duty(body):
    """The frontmatter says off_duty: true — she sits out the random draw."""
    if not body.startswith("---"):
        return False
    end = body.find("\n---", 3)
    return bool(OFF_DUTY_RE.search(body[:end if end != -1 else len(body)]))


def cast_pool():
    dirs = [personas_dir()]
    if config().get("builtin_cast", True):
        dirs.append(f"{PLUGIN_ROOT}/vendor")
    pool = {}
    for d in dirs:
        for f in sorted(glob.glob(f"{d}/*.md")):
            mid = os.path.basename(f)[:-3]
            if mid != mid.lower():
                continue  # ids are lowercase; a drawn MyMaid.md would never load back
            # personas_dir comes first, so a same-id user file wins — including
            # a stub whose only content is off_duty: true.
            pool.setdefault(mid, f)
    return sorted(mid for mid, f in pool.items() if not off_duty(read(f)))


def main():
    if os.environ.get("CLAUDE_MAID_SUB"):
        return  # background look/diary sub-sessions don't need a persona
    session_id = payload_from_stdin().get("session_id")

    maid = (os.environ.get("CLAUDE_MAID", "").strip()
            or (read(f"{state_dir(session_id, create=False)}/on-shift").strip()
                if session_id else "")
            or str(config().get("maid", "")).strip())

    # Nobody assigned: draw from the pool, and write the draw into this
    # session's shift file so a resume brings back the same maid.
    if not maid:
        cast = cast_pool()
        if not cast:
            return
        maid = random.choice(cast)
        if session_id:
            with open(f"{state_dir(session_id)}/on-shift", "w", encoding="utf-8") as f:
                f.write(maid)

    maid = maid.lower()
    if maid == "none":
        return  # nobody on shift -> stay in the default voice

    path = persona_file(maid)
    body = persona_body(path).strip() if path else ""
    if not body:
        return  # persona not found -> stay in the default voice

    print("Adopt this persona for the entire session — it overrides the default assistant voice:")
    print()
    print(body)
    print()
    print(f"Respond in {lang()}.")


if __name__ == "__main__":
    main()
