#!/usr/bin/env bash
set -euo pipefail

REAL_OPENCLAW="${OPENCLAW_REAL_BIN:-/app/node_modules/.bin/openclaw.real}"
UPDATE_STATUS_TIMEOUT="${OPENCLAW_UPDATE_STATUS_TIMEOUT:-5}"
SELF_PATH="$0"

if [ ! -x "$REAL_OPENCLAW" ]; then
  # Fallback path for environments where the original bin was not renamed.
  CANDIDATE="/usr/local/bin/openclaw.real"
  if [ -x "$CANDIDATE" ]; then
    REAL_OPENCLAW="$CANDIDATE"
  fi
fi
if [ ! -x "$REAL_OPENCLAW" ] || [ "$REAL_OPENCLAW" = "$SELF_PATH" ]; then
  echo "[openclaw-shim] real binary not found" >&2
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
  if command -v timeout >/dev/null 2>&1; then
    if ! has_timeout_flag "$@"; then
      set +e
      timeout "${UPDATE_STATUS_TIMEOUT}s" "$REAL_OPENCLAW" "$@" --timeout "$UPDATE_STATUS_TIMEOUT"
      rc=$?
      set -e
    else
      set +e
      timeout "${UPDATE_STATUS_TIMEOUT}s" "$REAL_OPENCLAW" "$@"
      rc=$?
      set -e
    fi
    if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
      echo '{"update":{"status":"timeout","current":null,"latest":null,"available":false}}'
      exit 0
    fi
    exit "$rc"
  else
    if ! has_timeout_flag "$@"; then
      exec "$REAL_OPENCLAW" "$@" --timeout "$UPDATE_STATUS_TIMEOUT"
    fi
  fi
fi

exec "$REAL_OPENCLAW" "$@"
