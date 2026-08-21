#!/usr/bin/env bash
# Bring the cast's artwork into the window.
#
# The characters package holds the drawings — a folder per maid, a folder per
# outfit inside her, already webp at the size she is shown. This mirrors that
# shape into src/assets/cast/, which is what the window globs at build time,
# and is the only record of where those files came from. Only the maids named
# here: the app carries their artwork and their persona, and shipping a maid
# whose sprite is missing is worse than not offering her.
#
# Run by `pnpm dev` and `pnpm build`, so a fresh clone never has to know.
set -euo pipefail

cast=(kotone kurumi)
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
drawings="$here/../../packages/characters"
out="$here/src/assets/cast"

[ -d "$drawings" ] || { echo "no characters package at $drawings" >&2; exit 1; }

rm -rf "$out"
for maid in "${cast[@]}"; do
  for wardrobe in "$drawings/$maid/expressions"/*/; do
    outfit=$(basename "$wardrobe")
    mkdir -p "$out/$maid/$outfit"
    cp "$wardrobe"*.webp "$out/$maid/$outfit/"
    # Her half-body portrait, for the places that show her small — the shift
    # panel picks between maids, and a full-length sprite an inch tall is a
    # smudge. Derived rather than drawn, and derived here rather than checked
    # in, because it is only ever this outfit's neutral seen closer.
    python3 "$drawings/scripts/crop-bust.py" --input "$wardrobe/neutral.webp" \
      --out "$out/$maid/$outfit/bust.webp" >/dev/null
    echo "$maid/$outfit: $(ls "$out/$maid/$outfit" | wc -l | tr -d ' ')"
  done
done
du -sh "$out"
