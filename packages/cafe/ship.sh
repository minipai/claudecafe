#!/bin/bash
set -e

# Ship the cafe plugin to the public shelf at claudecafe.dev/plugins/:
# run the tests, build vendor/, zip a versioned archive, regenerate the
# public marketplace.json (archive source + sha256) and upload both.
#
# Published zips are immutable — same version twice aborts; bump the version
# (plugin.json + root marketplace.json) instead. Old zips stay up: the shelf
# doubles as the release archive and instant rollback.
#
# SHIP_DRY=1 stops after building dist/ (nothing uploaded).

DROPLET="root@134.199.156.190"
REMOTE_DIR="/var/www/plugins"   # served by Caddy at claudecafe.dev/plugins/
BASE_URL="https://claudecafe.dev/plugins"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLUGIN="$REPO_ROOT/packages/cafe"
DIST="$PLUGIN/dist"

echo "=== cafe plugin ship ==="

python3 "$PLUGIN/test.py" 2>&1 | tail -3
python3 "$PLUGIN/build.py"

VERSION=$(python3 -c "import json; print(json.load(open('$PLUGIN/.claude-plugin/plugin.json'))['version'])")
ZIP="cafe-$VERSION.zip"

# A published version is frozen; republishing the same number would hand two
# different sha256s to the world.
if [ -z "$SHIP_DRY" ] && curl -sfI "$BASE_URL/$ZIP" >/dev/null 2>&1; then
    echo "✗ $ZIP is already on the shelf — bump the version first." >&2
    exit 1
fi

# Stage only what the plugin needs at runtime (no build/test tooling).
rm -rf "$DIST" && mkdir -p "$DIST/stage"
for item in .claude-plugin bin hooks commands prompts vendor README.md; do
    cp -R "$PLUGIN/$item" "$DIST/stage/$item"
done
find "$DIST/stage" -type d -name __pycache__ -exec rm -rf {} +
(cd "$DIST/stage" && zip -qr "../$ZIP" .)

SHA=$(shasum -a 256 "$DIST/$ZIP" | cut -d' ' -f1)

# The public marketplace lists cafe only; name/description/author come from
# the repo marketplace so the two never drift.
ROOT_MP="$REPO_ROOT/.claude-plugin/marketplace.json" DIST="$DIST" \
    ZIP_URL="$BASE_URL/$ZIP" SHA="$SHA" python3 <<'EOF'
import json, os
root = json.load(open(os.environ["ROOT_MP"]))
cafe = next(p for p in root["plugins"] if p["name"] == "cafe")
public = {
    "name": root["name"],
    "owner": {"name": root["owner"]["name"], "url": "https://claudecafe.dev"},
    "metadata": root["metadata"],
    "plugins": [{
        "name": cafe["name"],
        "description": cafe["description"],
        "version": cafe["version"],
        "author": cafe["author"],
        "source": {
            "source": "archive",
            "url": os.environ["ZIP_URL"],
            "sha256": os.environ["SHA"],
        },
    }],
}
with open(f"{os.environ['DIST']}/marketplace.json", "w") as f:
    json.dump(public, f, indent=2, ensure_ascii=False)
    f.write("\n")
EOF

echo "dist ready: $ZIP (sha256 $SHA)"
[ -n "$SHIP_DRY" ] && { echo "(dry run — nothing uploaded)"; exit 0; }

ssh "$DROPLET" "mkdir -p $REMOTE_DIR"
scp -q "$DIST/$ZIP" "$DIST/marketplace.json" "$DROPLET:$REMOTE_DIR/"

# The shelf must agree with what we just built, byte for byte.
LIVE_SHA=$(curl -sf "$BASE_URL/$ZIP" | shasum -a 256 | cut -d' ' -f1)
[ "$LIVE_SHA" = "$SHA" ] || { echo "✗ live zip sha mismatch!" >&2; exit 1; }
curl -sf "$BASE_URL/marketplace.json" | python3 -m json.tool >/dev/null

echo "=== shipped: $BASE_URL/marketplace.json → $ZIP ==="
