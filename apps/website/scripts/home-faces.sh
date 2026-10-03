#!/usr/bin/env bash
# The sixteen faces on the homepage's app slide: Kotone's per-expression
# avatars from her character pack, already the 256px squares the roughly
# 125px grid cells want on Retina screens, so they are copied as they are.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../.." && pwd)
avatars=$root/packages/characters/kotone/avatars
out=$root/apps/website/public/assets/home/faces

faces=(happy curious thinking embarrassed
       pouty surprised proud sad
       wink smug worried angry
       confused sorry relieved excited)

mkdir -p "$out"
for face in "${faces[@]}"; do
  cp "$avatars/$face.webp" "$out/$face.webp"
done
