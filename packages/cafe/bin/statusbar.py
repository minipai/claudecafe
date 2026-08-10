#!/usr/bin/env python3
"""The maid status line: all rows, or one row picked by argv.

Native statusLine renders each stdout line as its own row — run with no argument:
  "statusLine": { "type": "command", "command": "python3 ~/.claude/cafe/bin/statusbar.py" }

ccstatusline custom-command widgets each hold a single row — pass the row number:
  statusbar.py 1   → the scene (whose subject is the maid's name)
  statusbar.py 2   → the dialogue

Two rows (bare name until the first look):
  くるみの側臉貼近螢幕，盯著滾動的 log……
  「ご主人様～快好了喔～」

Prints nothing when nobody is on shift or the row has no content yet.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from maidstate import payload_from_stdin, status_lines


def main():
    lines = status_lines(payload_from_stdin().get("session_id"))
    if len(sys.argv) > 1:
        try:
            idx = int(sys.argv[1]) - 1
        except ValueError:
            return  # a mistyped widget arg gets an empty row, not a traceback
        lines = lines[idx:idx + 1] if idx >= 0 else []
    for line in lines:
        print(line)


if __name__ == "__main__":
    main()
