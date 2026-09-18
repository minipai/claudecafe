#!/usr/bin/env python3
"""Shared path rules for the Cafe's state files.

Each session gets its own state so several open windows never overwrite each
other, and every host reads and writes one shared data root.
"""
import json
import os
import sys

from cafehome import cafe_root

HOME = os.path.expanduser("~")
ROOT = str(cafe_root())
CONFIG = f"{ROOT}/config.json"  # all persistent settings in one file

# This file lives in <plugin>/bin/, so maids/ (the bundled fallback maid) is
# next door. Resolved relatively; version bumps in the cache path don't matter.
PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

def config():
    """The Cafe's shared config.json — every key optional:
    lang (reply language), maid (fixed pick, "none" = nobody),
    personas_dir (folder of the user's own personas),
    commit_authorship ("co-author" or "author"),
    builtin_cast (false = drop the bundled fallback maid too, so an empty
    personas_dir means nobody on shift).
    Individual retirement lives in each persona's own frontmatter: off_duty."""
    try:
        with open(CONFIG, encoding="utf-8") as f:
            data = json.load(f)
        # A hand-edited file may hold valid JSON that isn't an object; treating
        # it as one would crash every hook at once.
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def personas_dir():
    """Where the user's own personas live; configurable, defaults inside ROOT."""
    d = str(config().get("personas_dir", "")).strip() or f"{ROOT}/personas"
    return os.path.expanduser(d)


def state_dir(session_id=None, create=True):
    """create=False is for read-only lookups, so merely asking who is on shift
    doesn't sprout empty dirs."""
    d = f"{ROOT}/sessions/{session_id}" if session_id else f"{ROOT}/sessions/_global"
    if create:
        os.makedirs(d, exist_ok=True)
    return d


def payload_from_stdin():
    """Hooks receive the session JSON on stdin."""
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


DEFAULT_LANG = "English"


def lang():
    """The reply language: one free-form sentence dropped verbatim into prompts
    as $lang. Lets non-Chinese users switch the whole set with one value."""
    return (os.environ.get("CLAUDE_MAID_LANG", "").strip()
            or str(config().get("lang", "")).strip()
            or DEFAULT_LANG)


def prompt(template, **values):
    """Read prompts/<template>.md and fill in the $placeholders."""
    from string import Template
    return Template(read(f"{PLUGIN_ROOT}/prompts/{template}.md")).safe_substitute(values).rstrip("\n")


def on_shift(session_id=None):
    """Return the maid id on shift, or None when nobody is.

    Priority: CLAUDE_MAID env > this session's shift file (the draw persisted
    at session start — what lets different windows run different maids) >
    config "maid" (a fixed pick instead of the draw).
    """
    maid = (os.environ.get("CLAUDE_MAID", "")
            or (read(f"{state_dir(session_id, create=False)}/on-shift")
                if session_id else "")
            or str(config().get("maid", ""))).strip().lower()
    return maid if maid and maid != "none" else None


def persona_body(path):
    """The persona instructions: the file minus its YAML frontmatter."""
    import re
    return re.sub(r"\A---\n.*?\n---\n", "", read(path), flags=re.S)


def persona_file(maid_id):
    """Find the persona file — the user's own folder wins over the bundled
    bundled maids/ (which gets overwritten on every plugin update). None if missing.
    A frontmatter-only file (a pure off_duty retirement stub) doesn't shadow
    the bundled maid: an explicit pick of a retired maid still loads her."""
    for d in (personas_dir(), f"{PLUGIN_ROOT}/maids"):
        path = f"{d}/{maid_id}.md"
        if os.path.exists(path) and persona_body(path).strip():
            return path
    return None
