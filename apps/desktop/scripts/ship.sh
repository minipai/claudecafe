#!/bin/bash
set -e

# Putting a ClaudeCafe release on the shelf. The shelf is an R2 bucket
# (claudecafe-downloads, served as dl.starcoder.dev) — versioned and never
# overwritten: the shelf doubles as the archive, and a release nobody can go
# back to is a release nobody should trust.
#
# The whole ceremony, in order:
#   1. bump "version" in package.json, commit
#   2. this script — package, zip, upload
#   3. apps/website/src/pages/AppPage.tsx: DOWNLOAD_URL and both dlMeta lines
#      (this script prints the exact values)
#   4. pnpm --filter @claudecafe/website ship — needs ssh to the droplet,
#      so that one is run by a human

cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
ZIP_NAME="ClaudeCafe-$VERSION-arm64.zip"
URL="https://dl.starcoder.dev/$ZIP_NAME"

# The never-overwritten rule, enforced rather than remembered.
if curl -sfI "$URL" >/dev/null 2>&1; then
  echo "$URL is already on the shelf — bump the version first." >&2
  exit 1
fi

pnpm package

# ditto, not zip: it keeps the signatures, symlinks and resource forks that
# make a .app open instead of shrug.
ZIP_PATH="$(mktemp -d)/$ZIP_NAME"
ditto -c -k --sequesterRsrc --keepParent release/mac-arm64/ClaudeCafe.app "$ZIP_PATH"

npx wrangler r2 object put "claudecafe-downloads/$ZIP_NAME" \
  --file "$ZIP_PATH" --content-type application/zip --remote

SIZE_MB=$(( $(stat -f%z "$ZIP_PATH") / 1024 / 1024 ))
rm -f "$ZIP_PATH"

echo ""
echo "On the shelf: $URL"
echo ""
echo "Left to do by hand:"
echo "  AppPage.tsx → DOWNLOAD_URL = '$URL'"
echo "  AppPage.tsx → dlMeta version/size (en + zh): v$VERSION · ${SIZE_MB} MB"
echo "  pnpm --filter @claudecafe/website ship"
