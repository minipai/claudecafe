#!/usr/bin/env bash
# Bring the cast's artwork into the window, as webp at the size it is shown.
#
# The characters package holds the drawings — a folder per maid, a folder per
# outfit inside her. This mirrors that shape into src/assets/cast/, which is
# what the window globs at build time, and is the only record of where those
# webps came from. Only the maids named here: the app carries their artwork and
# their persona, and shipping a maid whose sprite is missing is worse than not
# offering her.
set -euo pipefail

cast=(kotone kurumi)
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
drawings="$here/../../packages/characters"
out="$here/src/assets/cast"

command -v cwebp >/dev/null || { echo "cwebp missing: brew install webp" >&2; exit 1; }

rm -rf "$out"
for maid in "${cast[@]}"; do
  for wardrobe in "$drawings/$maid/expressions"/*/; do
    outfit=$(basename "$wardrobe")
    mkdir -p "$out/$maid/$outfit"
    for art in "$wardrobe"*.webp; do
      # -alpha_q 100 keeps her outline lossless: she stands on a transparent
      # window, so a soft edge is the one thing the desktop shows through.
      cwebp -quiet -q 88 -alpha_q 100 "$art" -o "$out/$maid/$outfit/$(basename "${art%.webp}").webp"
    done
    # Her half-body portrait, for the places that show her small — the shift
    # panel picks between maids, and a full-length sprite an inch tall is a
    # smudge. Derived rather than drawn, and derived here rather than checked
    # in, because it is only ever this outfit's neutral seen closer.
    python3 "$drawings/scripts/crop-bust.py" --input "$wardrobe/neutral.webp" \
      --out "$out/$maid/$outfit/bust.webp" >/dev/null
    cwebp -quiet -q 90 -alpha_q 100 "$out/$maid/$outfit/bust.webp" -o "$out/$maid/$outfit/bust.webp"
    rm "$out/$maid/$outfit/bust.webp"
    echo "$maid/$outfit: $(ls "$out/$maid/$outfit" | wc -l | tr -d ' ')"
  done
done
du -sh "$out"
