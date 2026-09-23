#!/bin/bash
set -euo pipefail

# Ship one marketplace plugin to the public shelf at claudecafe.dev/plugins/:
# run its tests, zip a versioned archive, update its entry in the public
# marketplace.json (archive source + sha256) and upload both.
#
#   scripts/ship-plugin.sh <cafe|cc-maid>
#
# Published zips are immutable — same version twice aborts; bump the version
# (plugin.json + root marketplace.json) instead. Old zips stay up: the shelf
# doubles as the release archive and instant rollback. Other plugins keep the
# entries already live, so shipping one never unpublishes another.
#
# SHIP_DRY=1 stops after building dist/ (nothing uploaded).

NAME="${1:?usage: scripts/ship-plugin.sh <cafe|cc-maid>}"

DROPLET="root@134.199.156.190"
# Inside caddy's existing RW mount (/opt/caddy-data → /data), so serving
# /plugins needed only a Caddyfile edit + reload, no container recreation.
REMOTE_DIR="/opt/caddy-data/plugins"
BASE_URL="https://claudecafe.dev/plugins"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Each plugin stages only what it needs at runtime (no build/test tooling).
case "$NAME" in
    cafe)
        PLUGIN="$REPO_ROOT/packages/cafe"
        ITEMS=(.claude-plugin .codex-plugin bin hooks skills prompts maids README.md)
        run_tests() { python3 "$PLUGIN/test.py" 2>&1 | tail -3; }
        ;;
    cc-maid)
        PLUGIN="$REPO_ROOT/mods/cc-maid"
        ITEMS=(.claude-plugin hooks pixels README.md)
        run_tests() { CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test "$PLUGIN" 2>&1 | tail -3; }
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
if [ -z "${SHIP_DRY:-}" ] && curl -sfI "$BASE_URL/$ZIP" >/dev/null 2>&1; then
    echo "✗ $ZIP is already on the shelf — bump the version first." >&2
    exit 1
fi

rm -rf "$DIST" && mkdir -p "$DIST/stage"
# -L: a linked folder (cc-maid's pixels/) ships as the files it links to.
for item in "${ITEMS[@]}"; do
    cp -RL "$PLUGIN/$item" "$DIST/stage/$item"
done
find "$DIST/stage" -type d -name __pycache__ -exec rm -rf {} +
(cd "$DIST/stage" && zip -qr "../$ZIP" .)

SHA=$(shasum -a 256 "$DIST/$ZIP" | cut -d' ' -f1)

curl -sf "$BASE_URL/marketplace.json" -o "$DIST/live.json"

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

ssh "$DROPLET" "mkdir -p $REMOTE_DIR"
scp -q "$DIST/$ZIP" "$DIST/marketplace.json" "$DROPLET:$REMOTE_DIR/"

# The shelf must agree with what we just built, byte for byte.
LIVE_SHA=$(curl -sf "$BASE_URL/$ZIP" | shasum -a 256 | cut -d' ' -f1)
[ "$LIVE_SHA" = "$SHA" ] || { echo "✗ live zip sha mismatch!" >&2; exit 1; }
curl -sf "$BASE_URL/marketplace.json" | python3 -m json.tool >/dev/null

echo "=== shipped: $BASE_URL/marketplace.json → $ZIP ==="
