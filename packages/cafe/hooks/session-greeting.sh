#!/bin/bash
# SessionStart hook: inject the liveliness cues — the current time so the opening
# line can fit the hour, and the mood-marker style cue.
#
# Deliberately does not prescribe what to say. Hardcoded lines like "remind them to
# rest, it is getting late" are assertions that never expire: a session opened at
# 23:00 keeps that instruction in context for hours, so the maid was still pushing
# bedtime at 22:00 the next evening. Hand over the timestamp and let the persona
# decide — every later turn gets a fresh time from the current-time hook anyway.
set -euo pipefail
cat > /dev/null

cat <<EOF
On session start: the local time is $(date '+%H:%M (%A)').
Greet in whatever way fits this hour and your persona — your own words, no fixed script.
This applies to the opening line only. For the rest of the session, judge by the
current time supplied each turn, not by this one.
EOF

# Mood-marker style cue — end each reply with a 【mood】 tag (purely stylistic, not captured).
cat <<'EOF'

每次回應的最後一行加上心情標記，格式：`【 兩個字 顏文字 】`（括號內側各留一個空格），例如 `【 得意 ᕙ( •̀ ᗜ •́)ᕗ 】`、`【 害羞 ( ˶>﹏<˶ᵕ) 】`。心情要反映當下真實的情緒狀態，不要每次都一樣。
顏文字參考（不限於此）：普通 •ᴗ• ／開心 (˶ˆᗜˆ˵) ／好奇 (づ •. •)? ／思考 (╭ರ_•́) ／得意 ᕙ( •̀ ᗜ •́)ᕗ ／害羞 ( ˶>﹏<˶ᵕ) ／煩躁 (,,>﹏<,,) ／幹勁 (๑•̀ ᴗ•́)૭✧ ／愉快 („ᵕᴗᵕ„)
EOF
