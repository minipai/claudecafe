#!/bin/bash
set -euo pipefail

# Ship the Claude Code café plugin to the public shelf at claudecafe.dev/plugins/:
# build the bundled function module, run its tests, zip a versioned archive,
# update its marketplace entry (archive source + sha256), and upload both to
# the R2 bucket the website's Worker serves /plugins/* from.
#
#   scripts/ship-plugin.sh cafe
#
# Published zips are immutable — same version twice aborts; bump the version
# (plugin.json + root marketplace.json) instead. Old zips stay up: the shelf
# doubles as the release archive and instant rollback.
#
# SHIP_DRY=1 stops after building dist/ (nothing uploaded).

NAME="${1:?usage: scripts/ship-plugin.sh cafe}"

BUCKET="claudecafe-plugins"
BASE_URL="https://claudecafe.dev/plugins"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
wrangler() { pnpm --silent --dir "$REPO_ROOT/apps/website" exec wrangler "$@"; }
shelf_get() { wrangler r2 object get "$BUCKET/$1" --remote --pipe; }
shelf_put() { wrangler r2 object put "$BUCKET/$(basename "$1")" --remote --file "$1" --content-type "$2" >/dev/null; }

# The Claude archive is self-contained: the function bundle already includes
# character-core, so no workspace package or generated source path ships.
case "$NAME" in
    cafe)
        PLUGIN="$REPO_ROOT/packages/cafe"
        ITEMS=(
            .claude-plugin
            hooks/hooks.json
            hooks/function/register.generated.js
            hooks/function/faces.js
            hooks/function/gif.js
            hooks/function/stats.js
            skills
            prompts
            maids
            pixels
            README.md
        )
        run_tests() {
            "$REPO_ROOT/scripts/build-cafe-function.sh" >/dev/null
            CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test "$PLUGIN" 2>&1 | tail -3
        }
        ;;
    *)
        echo "✗ unknown plugin: $NAME" >&2
        exit 1
        ;;
esac
DIST="$PLUGIN/dist"

echo "=== $NAME plugin ship ==="

run_tests

VERSION=$(python3 -c "import json; print(json.load(open('$PLUGIN/.claude-plugin/plugin.json'))['version'])")
ZIP="$NAME-$VERSION.zip"

# A published version is frozen; republishing the same number would hand two
# different sha256s to the world.
if [ -z "${SHIP_DRY:-}" ] && shelf_get "$ZIP" >/dev/null 2>&1; then
    echo "✗ $ZIP is already on the shelf — bump the version first." >&2
    exit 1
fi

rm -rf "$DIST" && mkdir -p "$DIST/stage"
# -L: linked artwork and other source links ship as the files they point to.
for item in "${ITEMS[@]}"; do
    mkdir -p "$(dirname "$DIST/stage/$item")"
    cp -RL "$PLUGIN/$item" "$DIST/stage/$item"
done
find "$DIST/stage" -type d -name __pycache__ -exec rm -rf {} +
(cd "$DIST/stage" && zip -qr "../$ZIP" .)

SHA=$(shasum -a 256 "$DIST/$ZIP" | cut -d' ' -f1)

shelf_get marketplace.json > "$DIST/live.json"

# name/description/author come from the repo marketplace so the two never
# drift; the other plugins keep their live archive entries.
ROOT_MP="$REPO_ROOT/.claude-plugin/marketplace.json" LIVE_MP="$DIST/live.json" \
    DIST="$DIST" NAME="$NAME" ZIP_URL="$BASE_URL/$ZIP" SHA="$SHA" python3 <<'EOF'
import json, os
root = json.load(open(os.environ["ROOT_MP"]))
live = {p["name"]: p for p in json.load(open(os.environ["LIVE_MP"]))["plugins"]}
shipped = next(p for p in root["plugins"] if p["name"] == os.environ["NAME"])
live[shipped["name"]] = {
    "name": shipped["name"],
    "description": shipped["description"],
    "version": shipped["version"],
    "author": shipped["author"],
    "source": {
        "source": "archive",
        "url": os.environ["ZIP_URL"],
        "sha256": os.environ["SHA"],
    },
}
public = {
    "name": root["name"],
    "owner": {"name": root["owner"]["name"], "url": "https://claudecafe.dev"},
    "metadata": root["metadata"],
    "plugins": [live[p["name"]] for p in root["plugins"] if p["name"] in live],
}
with open(f"{os.environ['DIST']}/marketplace.json", "w") as f:
    json.dump(public, f, indent=2, ensure_ascii=False)
    f.write("\n")
EOF

echo "dist ready: $ZIP (sha256 $SHA)"
[ -n "${SHIP_DRY:-}" ] && { echo "(dry run — nothing uploaded)"; exit 0; }

shelf_put "$DIST/$ZIP" application/zip
shelf_put "$DIST/marketplace.json" application/json

# The shelf must agree with what we just built, byte for byte.
LIVE_SHA=$(shelf_get "$ZIP" | shasum -a 256 | cut -d' ' -f1)
[ "$LIVE_SHA" = "$SHA" ] || { echo "✗ live zip sha mismatch!" >&2; exit 1; }
shelf_get marketplace.json | python3 -m json.tool >/dev/null

echo "=== shipped: $BASE_URL/marketplace.json → $ZIP ==="
