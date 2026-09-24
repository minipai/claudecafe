#!/usr/bin/env bash
# The sixteen faces on the homepage's app slide: Kotone's face, cropped from
# her portraits in the cast package — the face itself, trimming hair and
# headdress rather than leaving room around them.
#
# Each face has its own box: she tilts her head and bows, so one crop for all
# of them leaves faces off to one side. The numbers are the middle of her hair
# across the head and the top of her headdress, in pixels of the 960 × 1280
# portrait.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../.." && pwd)
cast=$root/packages/characters/kotone/portraits
out=$root/apps/website/src/assets/home/faces

faces=(happy:476:37 curious:500:66 thinking:448:21 embarrassed:483:42
       pouty:483:50 surprised:470:37 proud:470:63 sad:472:54
       wink:477:39 smug:442:29 worried:476:41 angry:472:39
       confused:470:43 sorry:478:139 relieved:474:41 excited:471:41)

rm -rf "$out"
mkdir -p "$out"
for entry in "${faces[@]}"; do
  IFS=: read -r face centre top <<< "$entry"
  ffmpeg -v error -y -i "$cast/$face.webp" \
    -vf "crop=330:330:$((centre - 165)):$((top + 75)),scale=240:240:flags=lanczos" \
    -c:v libwebp -quality 85 "$out/$face.webp"
done
