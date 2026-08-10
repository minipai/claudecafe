#!/usr/bin/env python3
"""Shared path rules for the maid state files.

Each Claude Code session gets its own state so several open windows never
overwrite each other. When no session_id is available, fall back to a global
dir so nothing breaks.
"""
import json
import os
import sys

HOME = os.path.expanduser("~")
ROOT = f"{HOME}/.claude/cafe"  # the plugin's one home under ~/.claude, named after it
CONFIG = f"{ROOT}/config.json"  # all persistent settings in one file
DIARY = f"{ROOT}/diary.md"  # one shared handover diary for the whole café

# This file lives in <plugin>/bin/, so maids/ (the bundled cast) is next door. Resolved relatively;
# version bumps in the cache path don't matter.
PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

def config():
    """~/.claude/cafe/config.json — every key optional:
    lang (reply language), maid (fixed pick, "none" = nobody),
    personas_dir (folder of the user's own personas),
    builtin_cast (false = the bundled maids sit out the draw entirely).
    Individual retirement lives in each persona's own frontmatter: off_duty."""
    try:
        with open(CONFIG, encoding="utf-8") as f:
            data = json.load(f)
        # A hand-edited file may hold valid JSON that isn't an object; treating
        # it as one would crash every hook and the status line at once.
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def personas_dir():
    """Where the user's own personas live; configurable, defaults inside ROOT."""
    d = str(config().get("personas_dir", "")).strip() or f"{ROOT}/personas"
    return os.path.expanduser(d)


def claude_bin():
    """Where the claude CLI lives — hooks run on a shell PATH that may not
    have it, and its install location varies per machine."""
    import shutil
    return shutil.which("claude") or f"{HOME}/.local/bin/claude"


def state_dir(session_id=None, create=True):
    """create=False is for read-only statusline widgets, so a mere refresh
    doesn't sprout empty dirs."""
    d = f"{ROOT}/sessions/{session_id}" if session_id else f"{ROOT}/sessions/_global"
    if create:
        os.makedirs(d, exist_ok=True)
    return d


def payload_from_stdin():
    """Statusline widgets and hooks both receive the session JSON on stdin."""
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


def status_lines(session_id):
    """The two status-line rows: the scene (whose subject is the maid's name,
    per the look prompt) and the dialogue. Before the first look, fall back to
    the bare name; nobody on shift returns []."""
    maid_id = on_shift(session_id)
    if not maid_id:
        return []
    look = [l.strip() for l in
            read(f"{state_dir(session_id, create=False)}/look.txt").splitlines() if l.strip()]
    scene = look[0] if look else display_name(maid_id)
    speech = look[1] if len(look) > 1 else ""
    if speech and not speech.startswith("「"):
        speech = f"「{speech}」"  # wrap the dialogue in quotes so it reads as speech
    return [scene, speech] if speech else [scene]


def display_name(maid_id):
    """Read name: from the persona frontmatter; fall back to the id."""
    import re
    path = persona_file(maid_id)
    if path:
        m = re.search(r"^name:\s*(.+)$", read(path), re.M)
        if m:
            return m.group(1).strip()
    return maid_id.capitalize()
