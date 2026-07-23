#!/usr/bin/env python3
"""Stop hook: 從 transcript 抓最後一則回應結尾的心情標記，寫入這個 session 的 mood.txt

心情標記格式：【 兩個字 顏文字 】
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "bin"))
from maidstate import state_dir

MOOD_RE = re.compile(r"【\s*(\S{1,4})\s+(.+?)\s*】")


def main():
    # 女僕「照鏡子」的子 session 也會輸出心情標記，別讓它蓋掉本場的心情
    if os.environ.get("CLAUDE_MAID_SUB"):
        return
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    path = payload.get("transcript_path")
    if not path or not os.path.exists(path):
        return
    mood_file = f"{state_dir(payload.get('session_id'))}/mood.txt"

    # Stop 事件可能早於 transcript 落地，等一下再讀，免得抓到上一則的心情
    time.sleep(0.5)

    with open(path, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    for line in reversed(lines[-400:]):
        try:
            entry = json.loads(line)
        except Exception:
            continue
        if entry.get("type") != "assistant":
            continue
        content = entry.get("message", {}).get("content") or []
        if isinstance(content, str):
            texts = [content]
        else:
            texts = [c.get("text", "") for c in content if c.get("type") == "text"]
        for text in reversed(texts):
            matches = MOOD_RE.findall(text)
            if matches:
                word, face = matches[-1]
                with open(mood_file, "w", encoding="utf-8") as out:
                    out.write(f"{word} {face}\n")
                return


if __name__ == "__main__":
    main()
