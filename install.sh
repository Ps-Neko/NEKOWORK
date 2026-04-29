#!/usr/bin/env bash
# HARNESS installer trampoline.
# Real work happens in scripts/install-plan.js / scripts/install-apply.js (Node 22+).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Windows / git-bash: cygpath 가 있으면 정규화
if command -v cygpath >/dev/null 2>&1; then
  ROOT_DIR="$(cygpath -w "$ROOT_DIR")"
fi

# Node 22+ 검증
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node 22+ 가 필요합니다. https://nodejs.org/" >&2
  exit 1
fi

NODE_MAJOR=$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "ERROR: Node 22+ 필요 (현재: $(node -v))" >&2
  exit 1
fi

# 인자 분리: --apply 가 있으면 install-apply.js, 아니면 install-plan.js
MODE="plan"
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --apply) MODE="apply" ;;
    --plan)  MODE="plan" ;;
    *)       ARGS+=("$arg") ;;
  esac
done

SCRIPT="$ROOT_DIR/scripts/install-${MODE}.js"

if [ ! -f "$SCRIPT" ]; then
  echo "ERROR: $SCRIPT 가 없습니다." >&2
  exit 1
fi

exec node "$SCRIPT" "${ARGS[@]}"
