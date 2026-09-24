#!/usr/bin/env bash
# The sixteen faces on the homepage's app slide: Kotone's head, cropped from
# her uniform expressions in the cast package — the face itself, trimming
# hair and headdress rather than leaving room around them.
#
# Each face has its own centre: she tilts her head, so one crop box for all
# of them leaves half the faces off to one side. The number is the middle of
# her hair across the head, in pixels of the 512-wide expression.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../.." && pwd)
cast=$root/packages/characters/kotone/expressions/uniform
out=$root/apps/website/src/assets/home/faces

faces=(happy:213 curious:300 thinking:216 embarrassed:239
       pouty:269 surprised:198 proud:211 sad:247
       wink:244 smug:245 worried:263 angry:266
       confused:204 sorry:244 relieved:253 impressed:248)

mkdir -p "$out"
for entry in "${faces[@]}"; do
  face=${entry%%:*}
  centre=${entry##*:}
  ffmpeg -v error -y -i "$cast/$face.webp" -vf "crop=160:160:$((centre - 80)):100" \
    -c:v libwebp -quality 85 "$out/$face.webp"
done
