#!/usr/bin/env python3
"""女僕狀態檔的共用路徑規則。

每個 Claude Code session 各有一份狀態，不然同時開好幾個視窗會互相蓋掉。
session_id 拿不到時退回全域目錄，至少不會壞掉。
"""
import glob
import json
import os
import sys

HOME = os.path.expanduser("~")
ROOT = f"{HOME}/.claude/maid-state"
SHIFT_FILE = f"{HOME}/.claude/maid-on-shift"  # 當班女僕是全域的，不分 session

# 這支住在 <plugin>/bin/，所以 vendor 就在隔壁。用相對路徑找，版本號怎麼跳都不影響。
PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

# 使用者自己寫的 persona 放家目錄，優先於 plugin 內建的——plugin 一更新就會被蓋掉。
PERSONA_PATHS = (
    f"{HOME}/.claude/maid-persona/{{id}}.md",
    f"{PLUGIN_ROOT}/vendor/{{id}}.md",
)


def state_dir(session_id=None, create=True):
    """create=False 給唯讀的 statusline widget 用，免得光是刷新就長出一堆空目錄。"""
    d = f"{ROOT}/{session_id}" if session_id else f"{ROOT}/_global"
    if create:
        os.makedirs(d, exist_ok=True)
    return d


def payload_from_stdin():
    """statusline widget 與 hook 都是從 stdin 收 session JSON。"""
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


def on_shift(session_id=None):
    """回傳當班女僕 id，沒人當班時回 None。

    優先序：CLAUDE_MAID 環境變數 > 這個 session 的排班 > 全域排班。
    session 專屬那層讓不同視窗可以各自派不同的女僕。
    """
    maid = (os.environ.get("CLAUDE_MAID", "")
            or (read(f"{state_dir(session_id, create=False)}/on-shift")
                if session_id else "")
            or read(SHIFT_FILE)).strip().lower()
    return maid if maid and maid != "none" else None


def persona_file(maid_id):
    """找 persona 檔，本地的優先。找不到回 None。"""
    for pattern in PERSONA_PATHS:
        hits = sorted(glob.glob(pattern.format(id=maid_id)), reverse=True)
        if hits:
            return hits[0]
    return None
