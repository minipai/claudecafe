#!/bin/bash
set -e

# Putting a ClaudeCafe release on the shelf. The shelf is the repository's
# GitHub Releases page: free to store and free to hand out, however many
# versions pile up, which R2 stopped being once a build passed a quarter of
# a gigabyte. A tag is never moved, so a version that is already out cannot
# be replaced, only succeeded — the shelf doubles as the archive, and a
# release nobody can go back to is a release nobody should trust.
#
# Everything up to 0.2.1 also lives on dl.starcoder.dev and those links keep
# working; nothing new is uploaded there.
#
# The whole ceremony, in order:
#   1. bump "version" in package.json, commit — the commit body becomes the
#      release notes, so write it for whoever is downloading
#   2. this script — package, zip, publish
#   3. apps/website/src/pages/AppPage.tsx: DOWNLOAD_URL and both dlMeta lines
#      (this script prints the exact values)
#   4. pnpm --filter @claudecafe/website ship — needs ssh to the droplet

cd "$(dirname "$0")/.."
REPO="minipai/claudecafe"
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
ZIP_NAME="ClaudeCafe-$VERSION-arm64.zip"
URL="https://github.com/$REPO/releases/download/$TAG/$ZIP_NAME"

# The machine's own proxy cannot carry a quarter-gigabyte upload — it fails
# after the build, at the very last step. Take it out of the way here rather
# than remember it every time.
gh() { env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy command gh "$@"; }

# The never-moved-tag rule, enforced rather than remembered.
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "$TAG is already on the shelf — bump the version first." >&2
  exit 1
fi

# What the release says is what the version bump said. Written once, in the
# commit, where it had to be written anyway.
NOTES=$(git log -1 --format=%b --grep="^chore(desktop): $VERSION$")
[ -n "$NOTES" ] || { echo "no 'chore(desktop): $VERSION' commit to take notes from" >&2; exit 1; }

pnpm package

# ditto, not zip: it keeps the signatures, symlinks and resource forks that
# make a .app open instead of shrug.
ZIP_PATH="$(mktemp -d)/$ZIP_NAME"
ditto -c -k --sequesterRsrc --keepParent release/mac-arm64/ClaudeCafe.app "$ZIP_PATH"
SIZE_MB=$(( $(stat -f%z "$ZIP_PATH") / 1024 / 1024 ))

gh release create "$TAG" "$ZIP_PATH" --repo "$REPO" \
  --title "ClaudeCafe $VERSION" \
  --notes "macOS · Apple silicon · ${SIZE_MB} MB

$NOTES
Unsigned build — on first launch, right-click the app and choose Open."

rm -f "$ZIP_PATH"

echo ""
echo "On the shelf: $URL"
echo ""
echo "Left to do by hand:"
echo "  AppPage.tsx → DOWNLOAD_URL = '$URL'"
echo "  AppPage.tsx → dlMeta version/size (en + zh): v$VERSION · ${SIZE_MB} MB"
echo "  pnpm --filter @claudecafe/website ship"
