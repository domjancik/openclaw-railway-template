#!/usr/bin/env bash
set -euo pipefail

REAL_OPENCLAW="${OPENCLAW_REAL_BIN:-/app/node_modules/.bin/openclaw}"
UPDATE_STATUS_TIMEOUT="${OPENCLAW_UPDATE_STATUS_TIMEOUT:-5}"

if [ ! -x "$REAL_OPENCLAW" ]; then
  echo "[openclaw-shim] real binary not found: $REAL_OPENCLAW" >&2
  exit 127
fi

has_timeout_flag() {
  for arg in "$@"; do
    case "$arg" in
      --timeout|--timeout=*)
        return 0
        ;;
    esac
  done
  return 1
}

if [ "${1:-}" = "update" ] && [ "${2:-}" = "status" ]; then
  if ! has_timeout_flag "$@"; then
    exec "$REAL_OPENCLAW" "$@" --timeout "$UPDATE_STATUS_TIMEOUT"
  fi
fi

exec "$REAL_OPENCLAW" "$@"
