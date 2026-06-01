#!/bin/bash
# Stop hook: extract mood tag 【...】 from assistant's last line and save to mood.txt
set -euo pipefail

LAST_LINE=$(jq -r '.last_assistant_message' | tail -1)
MOOD=$(echo "$LAST_LINE" | sed -n 's/.*【 *\(.*[^ ]\) *】.*/\1/p')

if [[ -n "$MOOD" ]]; then
  printf '%s' "$MOOD" > "$HOME/.claude/mood.txt"
fi
