#!/bin/bash
# UserPromptSubmit hook: surface the real current time on every turn, so the
# assistant never assumes the SessionStart greeting's (now-stale) clock still holds.
set -euo pipefail
cat > /dev/null   # drain the hook payload on stdin
echo "Current time: $(date '+%Y-%m-%d %H:%M (%A) %Z')"
