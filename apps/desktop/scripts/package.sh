#!/bin/bash
set -e

# Packaging her while she is standing on the desktop does not fail where it
# looks like it failed: electron-builder writes the whole bundle happily, and
# only the ad-hoc signature at the very end is refused —
#
#   release/mac-arm64/ClaudeCafe.app: Operation not permitted
#
# leaving a .app that looks freshly built and will not open. On arm64 an
# unsigned bundle is not a warning, it is a locked door.
#
# Same reasoning as ship.sh's never-overwrite rule: checked here rather than
# remembered, because the one time it is forgotten is the time it costs a
# five-minute build and hands over a broken app.
cd "$(dirname "$0")/.."
APP=release/mac-arm64/ClaudeCafe.app

if pgrep -f "$APP/Contents/MacOS" >/dev/null; then
  echo "ClaudeCafe is running — quit her first." >&2
  echo "The signature at the end of this cannot replace one on a bundle in use." >&2
  exit 1
fi

pnpm build
electron-builder --mac --dir
codesign --force --deep --sign - "$APP"
# Proof rather than hope: an unsigned bundle opens nowhere, so a package step
# that cannot say the signature is good has not finished.
codesign --verify --deep --strict "$APP"
