#!/bin/bash
# SessionStart hook: output time-aware greeting context for the agent
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
