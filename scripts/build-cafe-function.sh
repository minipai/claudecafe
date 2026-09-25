#!/usr/bin/env bash
set -euo pipefail

# Bundle the Claude function profile and the shared character core into the
# plain ESM module loaded by Claude's function-hook runtime.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bun build "$ROOT/packages/cafe/hooks/function/register.js" \
  --target=browser \
  --outfile "$ROOT/packages/cafe/hooks/function/register.generated.js"
