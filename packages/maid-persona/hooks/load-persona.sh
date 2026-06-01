#!/bin/bash
# SessionStart hook: put a maid "on shift".
# Injects the chosen persona's body (frontmatter stripped) into the session so
# Claude speaks in character. The cast lives in the sibling `maids` package.
#
#   CLAUDE_MAID       which maid is on shift (default: kurumi)
#   CLAUDE_MAIDS_DIR  where the persona *.md live (default: sibling maids package)
set -euo pipefail
cat > /dev/null   # drain the hook payload on stdin

MAID="${CLAUDE_MAID:-kurumi}"
CAST_DIR="${CLAUDE_MAIDS_DIR:-${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}/../maids}"
FILE="$CAST_DIR/$MAID.md"

[ -f "$FILE" ] || exit 0   # no persona file -> stay in the default voice

echo "Adopt this persona for the entire session — it overrides the default assistant voice:"
echo
# Emit the body, stripping the leading YAML frontmatter (--- ... ---).
awk 'NR==1 && $0=="---"{f=1; next} f && $0=="---"{f=0; next} !f' "$FILE"
echo
echo "Respond in 台灣中文."
