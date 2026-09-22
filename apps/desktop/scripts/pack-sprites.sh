#!/usr/bin/env bash
# Bring the cast's artwork into the window.
#
# The characters package holds each maid's default portraits at portraits/ and
# optional outfits under variants/<outfit>/portraits/. This mirrors that into
# src/assets/cast/<maid>/<outfit>/, which the window globs at build time,
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
  root="$drawings/$maid"
  for wardrobe in "$root/portraits" "$root/variants"/*/portraits; do
    [ -d "$wardrobe" ] || continue
    if [ "$wardrobe" = "$root/portraits" ]; then
      outfit=uniform
    else
      outfit=$(basename "$(dirname "$wardrobe")")
    fi
    mkdir -p "$out/$maid/$outfit"
    cp "$wardrobe"/*.webp "$out/$maid/$outfit/"
    cp "$root/avatar.webp" "$out/$maid/$outfit/avatar.webp"
    echo "$maid/$outfit: $(ls "$out/$maid/$outfit" | wc -l | tr -d ' ')"
  done
done
du -sh "$out"
