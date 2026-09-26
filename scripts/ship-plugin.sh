#!/bin/bash
set -euo pipefail

# Ship the Claude Code café plugin to the public shelf at claudecafe.dev/plugins/:
# build the bundled function module, run its tests, zip a versioned archive,
# update its marketplace entry (archive source + sha256), and upload both to
# the R2 bucket the website's Worker serves /plugins/* from.
#
#   scripts/ship-plugin.sh persona-panel
#
# Published zips are immutable — same version twice aborts; bump the version
# (plugin.json + root marketplace.json) instead. Old zips stay up: the shelf
# doubles as the release archive and instant rollback.
#
# The built plugin is also committed to its release branch, which the
# Claude plugin directory tracks: the directory reads a branch as-is and runs
# no build, so the bundled cast only exists there and in the zip.
#
# SHIP_DRY=1 stops after building dist/ (nothing uploaded or pushed).

NAME="${1:?usage: scripts/ship-plugin.sh persona-panel}"

BUCKET="claudecafe-plugins"
BASE_URL="https://claudecafe.dev/plugins"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
wrangler() { pnpm --silent --dir "$REPO_ROOT/apps/website" exec wrangler "$@"; }
shelf_get() { wrangler r2 object get "$BUCKET/$1" --remote --pipe; }
shelf_put() { wrangler r2 object put "$BUCKET/$(basename "$1")" --remote --file "$1" --content-type "$2" >/dev/null; }

# The Claude archive is the built plugin: the function bundle already includes
# character-core, so no workspace package ships.
case "$NAME" in
    persona-panel)
        PLUGIN="$REPO_ROOT/packages/persona-panel"
        RELEASE="release/persona-panel"
        build() {
            "$REPO_ROOT/scripts/build-plugin.sh" >/dev/null
            CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test "$DIST" 2>&1 | tail -3
            rm -rf "$DIST/tests"
        }
        ;;
    *)
        echo "✗ unknown plugin: $NAME" >&2
        exit 1
        ;;
esac
DIST="$PLUGIN/dist"
# The archive and the marketplace files are only needed until they are uploaded.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "=== $NAME plugin ship ==="

build

VERSION=$(python3 -c "import json; print(json.load(open('$PLUGIN/.claude-plugin/plugin.json'))['version'])")
ZIP="$NAME-$VERSION.zip"

# A published version is frozen; republishing the same number would hand two
# different sha256s to the world.
if [ -z "${SHIP_DRY:-}" ] && shelf_get "$ZIP" >/dev/null 2>&1; then
    echo "✗ $ZIP is already on the shelf — bump the version first." >&2
    exit 1
fi

(cd "$DIST" && zip -qr "$WORK/$ZIP" .)

SHA=$(shasum -a 256 "$WORK/$ZIP" | cut -d' ' -f1)

shelf_get marketplace.json > "$WORK/live.json"

# name/description/author come from the repo marketplace so the two never
# drift; the other plugins keep their live archive entries.
ROOT_MP="$REPO_ROOT/.claude-plugin/marketplace.json" LIVE_MP="$WORK/live.json" \
    WORK="$WORK" NAME="$NAME" ZIP_URL="$BASE_URL/$ZIP" SHA="$SHA" python3 <<'EOF'
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
with open(f"{os.environ['WORK']}/marketplace.json", "w") as f:
    json.dump(public, f, indent=2, ensure_ascii=False)
    f.write("\n")
EOF

echo "dist ready: $ZIP (sha256 $SHA)"
[ -n "${SHIP_DRY:-}" ] && { echo "(dry run — nothing uploaded)"; exit 0; }

shelf_put "$WORK/$ZIP" application/zip
shelf_put "$WORK/marketplace.json" application/json

# The shelf must agree with what we just built, byte for byte.
LIVE_SHA=$(shelf_get "$ZIP" | shasum -a 256 | cut -d' ' -f1)
[ "$LIVE_SHA" = "$SHA" ] || { echo "✗ live zip sha mismatch!" >&2; exit 1; }
shelf_get marketplace.json | python3 -m json.tool >/dev/null

# One commit per shipped version on top of the branch's last one, built from
# the built plugin alone so the working tree and main stay untouched.
PARENT=()
if git -C "$REPO_ROOT" fetch -q origin "$RELEASE" 2>/dev/null; then
    PARENT=(-p "$(git -C "$REPO_ROOT" rev-parse FETCH_HEAD)")
fi
TREE=$(GIT_INDEX_FILE="$WORK/release.index" git -C "$REPO_ROOT" --work-tree="$DIST" add -A . \
    && GIT_INDEX_FILE="$WORK/release.index" git -C "$REPO_ROOT" write-tree)
COMMIT=$(git -C "$REPO_ROOT" commit-tree "$TREE" "${PARENT[@]}" -m "$NAME $VERSION")
git -C "$REPO_ROOT" push -q origin "$COMMIT:refs/heads/$RELEASE"

echo "=== shipped: $BASE_URL/marketplace.json → $ZIP, $RELEASE @ ${COMMIT:0:7} ==="
