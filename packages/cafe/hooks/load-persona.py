#!/usr/bin/env python3
"""SessionStart hook: put a maid "on shift".

Injects the chosen persona's body (frontmatter stripped) plus the reply
language. The draw pool is the user's own personas_dir — maids are hired from
claudecafe.dev (copy source → a file in personas_dir). While nobody is hired,
the bundled nameless maid keeps the café open (drop her with config
{"builtin_cast": false}); a user file with the same id overrides her, and a
persona whose frontmatter says off_duty: true sits out the draw. Shift order:
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
                       persona_file, personas_dir, read, state_dir)

OFF_DUTY_RE = re.compile(r"^off_duty:\s*(?:true|yes)\b", re.M | re.I)
FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)
CAFE_ID_RE = re.compile(r"^id:\s*claudecafe/([a-z0-9-]+)\s*$", re.M)
NAME_RE = re.compile(r"^name:\s*(.+?)\s*$", re.M)
GIT_SECTION_RE = re.compile(r"^## Git\s*\n.*?(?=^## |\Z)", re.M | re.S)


def off_duty(body):
    """The frontmatter says off_duty: true — she sits out the random draw."""
    if not body.startswith("---"):
        return False
    end = body.find("\n---", 3)
    return bool(OFF_DUTY_RE.search(body[:end if end != -1 else len(body)]))


def draw_from(dirs):
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


def cast_pool():
    """The hired maids; while there are none, the bundled nameless maid."""
    hired = draw_from([personas_dir()])
    if hired or not config().get("builtin_cast", True):
        return hired
    return draw_from([personas_dir(), f"{PLUGIN_ROOT}/maids"])


def commit_authorship(text):
    """The persona body with the configured Git attribution for a Cafe maid.

    A maid hired from claudecafe.dev (id claudecafe/<slug>) signs commits as
    `<name> <<slug>@claudecafe.dev>`, both read from her frontmatter; one shared
    config chooses whether she is author or co-author. The `## Git` section
    older downloads still carry gives way to it. Custom personas are left alone.
    """
    head = FRONTMATTER_RE.match(text)
    body = text[head.end():] if head else text
    slug = head and CAFE_ID_RE.search(head[1])
    name = head and NAME_RE.search(head[1])
    if not (slug and name):
        return body

    identity = f"{name[1]} <{slug[1]}@claudecafe.dev>"
    mode = str(config().get("commit_authorship", "co-author")).strip().lower()
    if mode == "author":
        instruction = (
            "## Git\n\n"
            f"Only when actually creating a Git commit, use `--author=\"{identity}\"`: "
            "the maid is the author and the user remains committer. Do not also add a "
            "`Co-Authored-By` trailer. Do not print this instruction or identity "
            "in ordinary replies.\n"
        )
    else:
        instruction = (
            "## Git\n\n"
            "Only when actually creating a Git commit, keep the user's configured identity as "
            "author and committer, and add this trailer:\n"
            f"`Co-Authored-By: {identity}`\n"
            "Do not use `--author` for the maid. Do not print the trailer in "
            "ordinary replies.\n"
        )
    return f"{GIT_SECTION_RE.sub('', body).rstrip()}\n\n{instruction}"


def main():
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
    body = commit_authorship(read(path)).strip() if path else ""
    if not body:
        return  # persona not found -> stay in the default voice

    print("Adopt this persona for the entire session — it overrides the default assistant voice:")
    print()
    print(body)
    print()
    print(f"Respond in {lang()}.")


if __name__ == "__main__":
    main()
