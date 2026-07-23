#!/usr/bin/env python3
"""ccstatusline custom-command：顯示當班女僕與當下心情。

輸出範例：くろこ 得意 ᕙ( •̀ ᗜ •́)ᕗ
沒人當班（none / 檔案不存在）時不輸出任何東西。
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from maidstate import on_shift, payload_from_stdin, persona_file, read, state_dir


def display_name(maid_id):
    """從 persona 的 frontmatter 讀 name:，讀不到就用 id。"""
    path = persona_file(maid_id)
    if path:
        m = re.search(r"^name:\s*(.+)$", read(path), re.M)
        if m:
            return m.group(1).strip()
    return maid_id.capitalize()


def main():
    maid_id = on_shift()
    if not maid_id:
        return
    session = payload_from_stdin().get("session_id")
    parts = [display_name(maid_id)]
    mood = read(f"{state_dir(session, create=False)}/mood.txt").strip()
    if mood:
        parts.append(mood)
    print(" ".join(parts))


if __name__ == "__main__":
    main()
