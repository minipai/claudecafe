#!/usr/bin/env python3
"""SessionStart hook: 新的一班開始，清掉這個 session 的狀態，順便掃走陳年舊檔。

不清的話（resume 的情況）statusbar 會掛著上一場結束時滿頭大汗的樣子，
但這時 context 已經重來，人明明才剛上工。清掉之後第一輪 Stop hook 就會重新照鏡子。

只清「自己這一份」——同時開著的其他 session 不受影響。
"""
import json
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "bin"))
from maidstate import ROOT, state_dir

STALE_DAYS = 7


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}

    sdir = state_dir(payload.get("session_id"))
    for name in ("look.txt", "look.ctx", "look.lock", "mood.txt"):
        try:
            os.unlink(f"{sdir}/{name}")
        except OSError:
            pass

    # 結束的 session 不會自己收拾，過期的就掃掉
    cutoff = time.time() - STALE_DAYS * 86400
    try:
        for entry in os.scandir(ROOT):
            if entry.is_dir() and entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry.path, ignore_errors=True)
    except OSError:
        pass


if __name__ == "__main__":
    main()
