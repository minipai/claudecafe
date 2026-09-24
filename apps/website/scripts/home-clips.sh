#!/usr/bin/env bash
# Kotone's four homepage transitions, from the transparent masters in
# art-masters/ (gitignored, beside the repo) to what the site ships.
#
# The clips are drawn onto the paper's colour rather than kept transparent:
# Safari drops the alpha of a WebM, and the page behind her is one flat colour.
# CRF 20 — at 28 her line art visibly roughens. The poster is taken from the
# master too, never from a re-encoded clip.
#
# A worktree has no art-masters of its own: pass ART_MASTERS=<path>.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../.." && pwd)
masters=${ART_MASTERS:-$root/art-masters}/kotone/transitions/video
out=$root/apps/website/src/assets/home
paper=0xfaf6f0 # --bg in styles.css

[ -d "$masters" ] || { echo "missing masters: $masters" >&2; exit 1; }

onto_paper() {
  ffmpeg -v error -y -c:v libvpx-vp9 -i "$masters/$1.webm" \
    -f lavfi -i "color=c=$paper:s=600x800:r=30" \
    -filter_complex "[1][0]overlay=shortest=1,format=yuv420p" "${@:2}"
}

for clip in full-portrait portrait-face face-portrait portrait-full; do
  onto_paper "$clip" -an \
    -c:v libx264 -preset veryslow -crf 20 -tune animation \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -movflags +faststart "$out/$clip.mp4"
done

onto_paper full-portrait -frames:v 1 -c:v libwebp -quality 92 "$out/full.webp"
