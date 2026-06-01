#!/bin/bash
# SessionStart hook: inject the liveliness cues — a time-aware greeting and the
# mood-marker protocol (whose tag the paired Stop hook, mood-update.sh, captures).
set -euo pipefail
cat > /dev/null

HOUR=$((10#$(date +%H)))
TIMENOW=$(date +%H:%M)

if (( HOUR >= 5 && HOUR < 12 )); then
  echo "On session start: It is $TIMENOW AM. Greet with good morning."
elif (( HOUR >= 12 && HOUR < 14 )); then
  echo "On session start: It is $TIMENOW noon. Greet with good afternoon, ask if they have eaten."
elif (( HOUR >= 14 && HOUR < 18 )); then
  echo "On session start: It is $TIMENOW PM. Greet with good afternoon."
elif (( HOUR >= 18 && HOUR < 23 )); then
  echo "On session start: It is $TIMENOW evening. Greet with good evening."
elif (( HOUR >= 23 || HOUR < 2 )); then
  echo "On session start: It is $TIMENOW late night. Greet, then gently remind them to rest soon, it is getting late."
else
  echo "On session start: It is $TIMENOW past midnight. Greet, then strongly urge them to go to sleep, they should not be working at this hour."
fi

# Mood-marker protocol — the emit half of the mood loop (capture half = mood-update.sh).
cat <<'EOF'

每次回應的最後一行加上心情標記，格式：`【 兩個字 顏文字 】`（括號內側各留一個空格），例如 `【 得意 ᕙ( •̀ ᗜ •́)ᕗ 】`、`【 害羞 ( ˶>﹏<˶ᵕ) 】`。心情要反映當下真實的情緒狀態，不要每次都一樣。Stop hook 會自動 parse 這行寫入 mood.txt，顯示在 status line 上。
顏文字參考（不限於此）：普通 •ᴗ• ／開心 (˶ˆᗜˆ˵) ／好奇 (づ •. •)? ／思考 (╭ರ_•́) ／得意 ᕙ( •̀ ᗜ •́)ᕗ ／害羞 ( ˶>﹏<˶ᵕ) ／煩躁 (,,>﹏<,,) ／幹勁 (๑•̀ ᴗ•́)૭✧ ／愉快 („ᵕᴗᵕ„)
EOF
