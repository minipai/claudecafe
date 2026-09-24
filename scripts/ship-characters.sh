#!/usr/bin/env bash
set -euo pipefail

# Build and publish one or more complete character packs to GitHub Releases.
# The desktop app consumes these archives from ~/.config/claudecafe/characters/;
# the cafe plugin continues to use the smaller persona files in personas/.
#
#   scripts/ship-characters.sh <maid-id> [maid-id ...]
#
# The version comes from the persona frontmatter. The archive is rooted at
# <maid-id>/ and contains the persona, avatar, portraits, pixels, and variants.
# SHIP_DRY=1 builds and validates the archives without creating a release.
# CHARACTER_REPO and CHARACTER_DIST override the GitHub repository and output
# directory for forks and local experiments.

usage() {
  echo "usage: scripts/ship-characters.sh <maid-id> [maid-id ...]" >&2
  echo "       SHIP_DRY=1 scripts/ship-characters.sh <maid-id>" >&2
  exit 2
}

[ "$#" -gt 0 ] || usage

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${CHARACTER_REPO:-minipai/claudecafe}"
DIST="${CHARACTER_DIST:-$REPO_ROOT/packages/characters/dist}"
DRY="${SHIP_DRY:-}"
IDS=("$@")

mkdir -p "$DIST"
DIST="$(cd "$DIST" && pwd)"

for command_name in python3 zip; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "✗ missing command: $command_name" >&2
    exit 1
  }
done
if command -v shasum >/dev/null 2>&1; then
  sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
elif command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$1" | awk '{print $1}'; }
else
  echo "✗ missing command: shasum or sha256sum" >&2
  exit 1
fi

if [ -z "$DRY" ]; then
  command -v gh >/dev/null 2>&1 || {
    echo "✗ missing command: gh (use SHIP_DRY=1 for a local build)" >&2
    exit 1
  }
  gh_cmd() { env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy gh "$@"; }
  gh_cmd auth status --hostname github.com >/dev/null
else
  gh_cmd() { :; }
fi

TARGET_COMMIT=""
if [ -z "$DRY" ]; then
  command -v git >/dev/null 2>&1 || {
    echo "✗ missing command: git (use SHIP_DRY=1 for a local build)" >&2
    exit 1
  }
  STATUS="$(git -C "$REPO_ROOT" status --porcelain --untracked-files=all)"
  if [ -n "$STATUS" ]; then
    echo "✗ release requires a clean, committed working tree" >&2
    printf '%s\n' "$STATUS" >&2
    exit 1
  fi
  TARGET_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
fi

metadata_version() {
  python3 - "$1" "$2" <<'PY'
import re
import sys
from pathlib import Path

folder = Path(sys.argv[1])
expected_id = f"claudecafe/{sys.argv[2]}"
personas = sorted(folder.glob("persona*.md"))
if not personas:
    raise SystemExit(f"no persona*.md in {folder}")

allowed = {"persona.md", "persona.en.md", "persona.zh.md"}
versions = set()
for path in personas:
    if path.name not in allowed:
        raise SystemExit(f"unsupported persona file: {path.name}")

    text = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)", text, re.S)
    if not match:
        raise SystemExit(f"{path} has no YAML frontmatter")
    fields = {}
    for line in match.group(1).splitlines():
        if re.match(r"^[A-Za-z_][A-Za-z0-9_-]*\s*:", line):
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip().strip("'\"")
    if fields.get("id") != expected_id:
        raise SystemExit(f"{path} has id {fields.get('id')!r}, expected {expected_id!r}")
    if not fields.get("name"):
        raise SystemExit(f"{path} has no name")
    version = fields.get("version", "")
    if not version:
        raise SystemExit(f"{path} has no version")
    versions.add(version)

if len(versions) != 1:
    raise SystemExit(f"persona versions disagree: {sorted(versions)}")
print(versions.pop())
PY
}

validate_archive() {
  python3 - "$1" "$2" <<'PY'
import sys
import zipfile

archive, maid_id = sys.argv[1:]
with zipfile.ZipFile(archive) as bundle:
    names = [name for name in bundle.namelist() if name and not name.endswith("/")]
invalid = [name for name in names if name != maid_id and not name.startswith(f"{maid_id}/")]
if invalid:
    raise SystemExit(f"archive has paths outside {maid_id}/: {invalid[:3]}")
required = f"{maid_id}/portraits/neutral.webp"
if required not in names:
    raise SystemExit(f"archive is missing {required}")
PY
}

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/claudecafe-characters.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT
STAGE_DIR="$TMP_DIR/stage"
mkdir -p "$STAGE_DIR" "$DIST"

TAGS=()
ASSETS=()
ZIPS=()
HASHES=()
VERSIONS=()
DISPLAY_NAMES=()
seen_ids=""

# Validate every requested pack before creating any release.
for maid_id in "${IDS[@]}"; do
  case " $seen_ids " in
    *" $maid_id "*)
      echo "✗ duplicate maid id: $maid_id" >&2
      exit 1
      ;;
  esac
  seen_ids="$seen_ids $maid_id"

  if [[ ! "$maid_id" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
    echo "✗ invalid maid id: $maid_id" >&2
    exit 1
  fi
  source_dir="$REPO_ROOT/packages/characters/$maid_id"
  if [ ! -d "$source_dir" ]; then
    echo "✗ character directory not found: $source_dir" >&2
    exit 1
  fi
  if [ ! -f "$source_dir/portraits/neutral.webp" ]; then
    echo "✗ $maid_id is missing portraits/neutral.webp" >&2
    exit 1
  fi

  version="$(metadata_version "$source_dir" "$maid_id")"
  if [[ ! "$version" =~ ^[0-9A-Za-z][0-9A-Za-z.+-]*$ ]]; then
    echo "✗ invalid version for $maid_id: $version" >&2
    exit 1
  fi
  display_name="$(printf '%s' "$maid_id" | awk '{print toupper(substr($0, 1, 1)) substr($0, 2)}')"
  tag="$maid_id-characters-v$version"
  asset="ClaudeCafe-$display_name-characters-v$version.zip"
  archive="$DIST/$asset"

  if [ -z "$DRY" ] && gh_cmd release view "$tag" --repo "$REPO" >/dev/null 2>&1; then
    echo "✗ release $tag already exists — bump the persona version first" >&2
    exit 1
  fi

  rm -f "$archive"
  cp -RL "$source_dir" "$STAGE_DIR/$maid_id"
  (cd "$STAGE_DIR" && zip -qr "$archive" "$maid_id")
  validate_archive "$archive" "$maid_id"
  hash="$(sha256 "$archive")"

  TAGS+=("$tag")
  ASSETS+=("$asset")
  ZIPS+=("$archive")
  HASHES+=("$hash")
  VERSIONS+=("$version")
  DISPLAY_NAMES+=("$display_name")
done

for index in "${!IDS[@]}"; do
  maid_id="${IDS[$index]}"
  tag="${TAGS[$index]}"
  asset="${ASSETS[$index]}"
  archive="${ZIPS[$index]}"
  hash="${HASHES[$index]}"
  version="${VERSIONS[$index]}"
  display_name="${DISPLAY_NAMES[$index]}"
  url="https://github.com/$REPO/releases/download/$tag/$asset"

  if [ -n "$DRY" ]; then
    echo "dry run: $maid_id $version"
    echo "  tag:    $tag"
    echo "  asset:  $asset"
    echo "  url:    $url"
    echo "  sha256: $hash"
    continue
  fi

  notes="$(cat <<EOF
Character artwork and persona for ClaudeCafe.
Install under ~/.config/claudecafe/characters/$maid_id.
EOF
)"
  gh_cmd release create "$tag" "$archive" --repo "$REPO" --target "$TARGET_COMMIT" \
    --title "$display_name character pack $version" \
    --notes "$notes"

  verify_dir="$TMP_DIR/verify-$index"
  mkdir -p "$verify_dir"
  gh_cmd release download "$tag" --repo "$REPO" --pattern "$asset" --dir "$verify_dir" --clobber
  live_hash="$(sha256 "$verify_dir/$asset")"
  if [ "$live_hash" != "$hash" ]; then
    echo "✗ published SHA-256 does not match the built archive" >&2
    exit 1
  fi

  echo "published $display_name $version"
  echo "  $url"
  echo "  sha256: $hash"
done

if [ -z "$DRY" ]; then
  echo
  echo "Update apps/desktop/electron/characters.ts with the new URL and SHA-256 before shipping a desktop build."
fi
