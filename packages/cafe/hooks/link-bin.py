#!/usr/bin/env python3
"""SessionStart hook: keep ~/.claude/cafe/bin pointing at this version's bin/.

ccstatusline runs the statusbar widgets itself, so it never sees
${CLAUDE_PLUGIN_ROOT} — its config needs an absolute path. The plugin's real
path carries the version (…/cafe/0.1.3/bin), so the config would break on every
bump. Point it at this symlink instead and the config never has to change.
"""
import os
import sys

sys.stdin.read()  # drain the hook payload

link = os.path.expanduser("~/.claude/cafe/bin")
target = os.environ.get("CLAUDE_PLUGIN_ROOT")
if not target:
    sys.exit(0)
target = f"{target}/bin"

os.makedirs(os.path.dirname(link), exist_ok=True)
try:
    if os.readlink(link) == target:
        sys.exit(0)
except OSError:
    pass
if os.path.lexists(link) and not os.path.islink(link):
    sys.exit(0)  # a real file/dir someone put there — never destroy it
try:
    if os.path.islink(link):
        os.remove(link)
    os.symlink(target, link)
except OSError:
    pass  # lost the race against another window's SessionStart; its link is fine
