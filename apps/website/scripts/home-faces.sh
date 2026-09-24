#!/usr/bin/env bash
# The sixteen faces on the homepage's app slide: Kotone's face, cropped from
# her PNG masters — the face itself, trimming hair and
# headdress rather than leaving room around them.
#
# Each face has its own box: she tilts her head and bows, so one crop for all
# of them leaves faces off to one side. The numbers are the middle of her hair
# across the head and the top of her headdress, in pixels of the 960 × 1280
# portrait. Scale those coordinates to the master before cropping, then
# resize only once to 256px for the roughly 125px grid cells on Retina screens.
# A light luminance sharpen keeps fine lines legible after downsampling.
# A worktree can pass ART_MASTERS=<path>.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../.." && pwd)
cast=${ART_MASTERS:-$root/art-masters}/kotone/portraits
out=$root/apps/website/public/assets/home/faces

faces=(happy:476:37 curious:500:66 thinking:448:21 embarrassed:483:42
       pouty:483:50 surprised:470:37 proud:470:63 sad:472:54
       wink:477:39 smug:442:29 worried:476:41 angry:472:39
       confused:470:43 sorry:478:139 relieved:474:41 excited:471:41)

[ -d "$cast" ] || { echo "missing masters: $cast" >&2; exit 1; }
mkdir -p "$out"
for entry in "${faces[@]}"; do
  IFS=: read -r face centre top <<< "$entry"
  ffmpeg -v error -y -i "$cast/$face.png" \
    -vf "crop=iw*330/960:ih*330/1280:iw*$((centre - 165))/960:ih*$((top + 75))/1280,scale=256:256:flags=lanczos,unsharp=3:3:0.4:3:3:0" \
    -c:v libwebp -quality 95 "$out/$face.webp"
done
