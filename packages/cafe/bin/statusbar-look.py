#!/usr/bin/env python3
"""ccstatusline custom-command：輸出這個 session 的 look.txt 指定行。

用法：statusbar-look.py 1   → 場景描寫
      statusbar-look.py 2   → 角色台詞
沒人當班或還沒生成過就不輸出。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from maidstate import on_shift, payload_from_stdin, read, state_dir


def main():
    idx = int(sys.argv[1]) - 1 if len(sys.argv) > 1 else 0
    session = payload_from_stdin().get("session_id")
    if not on_shift(session):
        return
    lines = [l for l in read(f"{state_dir(session, create=False)}/look.txt").splitlines() if l.strip()]
    if idx >= len(lines):
        return
    text = lines[idx].strip()
    if idx == 1 and not text.startswith("「"):
        text = f"「{text}」"  # 第 2 行是台詞，補上引號才像在說話
    print(text)


if __name__ == "__main__":
    main()
