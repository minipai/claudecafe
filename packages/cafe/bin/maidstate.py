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


def on_shift():
    """回傳當班女僕 id，沒人當班時回 None。"""
    maid = read(SHIFT_FILE).strip().lower()
    return maid if maid and maid != "none" else None


def persona_file(maid_id):
    """找 persona 檔，本地的優先。找不到回 None。"""
    for pattern in PERSONA_PATHS:
        hits = sorted(glob.glob(pattern.format(id=maid_id)), reverse=True)
        if hits:
            return hits[0]
    return None
