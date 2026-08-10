#!/usr/bin/env python3
"""Print today's festival; silent on ordinary days (the per-turn "now" line
only grows a segment when something is on).

The built-in pack is the maid-café calendar — the days a maid would fuss over
(Valentine's, White Day, Maid Day…), not any country's public holidays. Swap in
your own via config: `"festivals": "~/my-festivals.json"` replaces the pack,
`"festivals": false` turns the segment off. A pack is one flat JSON object of
fixed solar dates — movable feasts (lunar calendar, nth-weekday rules) are out
of scope:

    {"02-14": "Valentine's Day", "12-24": "Christmas Eve"}
"""
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from maidstate import config

MAID_PACK = {
    "01-01": "New Year's Day",
    "02-14": "Valentine's Day",
    "03-03": "Hinamatsuri (Girls' Day)",
    "03-14": "White Day",
    "05-10": "Maid Day (メイドの日)",
    "07-07": "Tanabata",
    "10-31": "Halloween",
    "12-24": "Christmas Eve",
    "12-25": "Christmas",
    "12-31": "New Year's Eve",
}


def load_pack():
    setting = config().get("festivals")
    if setting is False:
        return None
    if isinstance(setting, str) and setting.strip():
        try:
            with open(os.path.expanduser(setting.strip()), encoding="utf-8") as f:
                pack = json.load(f)
        except Exception:
            return None  # a broken custom pack degrades to silence, not a crash
        return pack if isinstance(pack, dict) else None
    return MAID_PACK


def today_festivals(today=None):
    pack = load_pack()
    if not pack:
        return []
    today = today or datetime.date.today()
    name = pack.get(f"{today.month:02d}-{today.day:02d}")
    return [name] if isinstance(name, str) and name else []


if __name__ == "__main__":
    found = today_festivals()
    if found:
        print("、".join(found))
