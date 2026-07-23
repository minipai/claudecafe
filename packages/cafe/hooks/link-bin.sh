#!/bin/bash
# SessionStart hook: keep ~/.claude/bin/cafe pointing at this version's bin/.
#
# ccstatusline runs the statusbar widgets itself, so it never sees
# ${CLAUDE_PLUGIN_ROOT} — its config needs an absolute path. The plugin's real
# path carries the version (…/cafe/0.1.3/bin), so the config would break on every
# bump. Point it at this symlink instead and the config never has to change.
set -euo pipefail
cat > /dev/null

LINK="$HOME/.claude/bin/cafe"
TARGET="$CLAUDE_PLUGIN_ROOT/bin"

mkdir -p "$HOME/.claude/bin"
[[ "$(readlink "$LINK" 2>/dev/null)" == "$TARGET" ]] || ln -sfn "$TARGET" "$LINK"
