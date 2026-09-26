#!/usr/bin/env bash
set -euo pipefail

# Build the Claude Code café plugin into packages/persona-panel/dist, the folder
# Claude loads: a hooks module may import only its own files by relative path,
# so register.js is bundled there with the shared character core, and the cast
# that has terminal pixels is copied in (personas and GIFs only, under the
# characters package's own license; the portraits stay out). The tests are
# copied too, so `claude plugin test` runs against what ships.
#
#   scripts/build-plugin.sh           # build once
#   scripts/build-plugin.sh --watch   # keep the bundle current while developing
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/packages/persona-panel"
DIST="$PLUGIN/dist"

rm -rf "$DIST" && mkdir -p "$DIST/hooks"
for item in .claude-plugin skills prompts fallback tests README.md LICENSE PRIVACY.md; do
  cp -R "$PLUGIN/$item" "$DIST/$item"
done
cp "$PLUGIN/hooks/hooks.json" "$DIST/hooks/hooks.json"

for pixels in "$ROOT"/packages/characters/*/pixels; do
  id="$(basename "$(dirname "$pixels")")"
  mkdir -p "$DIST/characters/$id/pixels"
  cp "$ROOT/packages/characters/$id"/persona*.md "$DIST/characters/$id/"
  cp "$pixels"/*.gif "$DIST/characters/$id/pixels/"
done
cp "$ROOT/packages/characters/LICENSE" "$DIST/characters/LICENSE"

bun build "$PLUGIN/hooks/function/register.js" \
  --target=browser \
  --outfile "$DIST/hooks/function/register.js" \
  "$@"
