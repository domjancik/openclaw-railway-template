#!/usr/bin/env bash
set -euo pipefail

TAILSCALE_AUTH_KEY="${TAILSCALE_AUTH_KEY:-}"
TAILSCALE_STATE_DIR="${TAILSCALE_STATE_DIR:-/data/.tailscale}"
TAILSCALE_SOCKET="${TAILSCALE_SOCKET:-${TAILSCALE_STATE_DIR}/tailscaled.sock}"
TAILSCALE_SOCKS_ADDR="${TAILSCALE_SOCKS_ADDR:-127.0.0.1:1055}"
TAILSCALE_HTTP_PROXY_ADDR="${TAILSCALE_HTTP_PROXY_ADDR:-127.0.0.1:1056}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-}"
TAILSCALE_ACCEPT_ROUTES="${TAILSCALE_ACCEPT_ROUTES:-false}"
TAILSCALE_INSTALL_ON_BOOT="${TAILSCALE_INSTALL_ON_BOOT:-true}"
TAILSCALE_ENABLE_PROXY_ENV="${TAILSCALE_ENABLE_PROXY_ENV:-true}"
TAILSCALE_FATAL_ON_FAILURE="${TAILSCALE_FATAL_ON_FAILURE:-false}"
TAILSCALE_LOG_FILE="${TAILSCALE_LOG_FILE:-${TAILSCALE_STATE_DIR}/tailscaled.log}"

log() {
  printf '[entrypoint] %s\n' "$*"
}

install_tailscale_if_missing() {
  if command -v tailscale >/dev/null 2>&1 && command -v tailscaled >/dev/null 2>&1; then
    return 0
  fi

  if [ "$TAILSCALE_INSTALL_ON_BOOT" != "true" ]; then
    log "tailscale is missing and TAILSCALE_INSTALL_ON_BOOT=false"
    return 1
  fi

  log "installing tailscale via official install script"
  curl -fsSL https://tailscale.com/install.sh | sh
}

start_tailscale() {
  mkdir -p "$TAILSCALE_STATE_DIR"

  if ! tailscale --socket="$TAILSCALE_SOCKET" status --json >/dev/null 2>&1; then
    log "starting tailscaled in userspace mode"
    log "tailscaled logs: $TAILSCALE_LOG_FILE"
    tailscaled \
      --tun=userspace-networking \
      --state="${TAILSCALE_STATE_DIR}/tailscaled.state" \
      --socket="$TAILSCALE_SOCKET" \
      --socks5-server="$TAILSCALE_SOCKS_ADDR" \
      --outbound-http-proxy-listen="$TAILSCALE_HTTP_PROXY_ADDR" >"$TAILSCALE_LOG_FILE" 2>&1 &

    local ready=0
    for _ in $(seq 1 80); do
      if tailscale --socket="$TAILSCALE_SOCKET" status --json >/dev/null 2>&1; then
        ready=1
        break
      fi
      sleep 0.5
    done

    if [ "$ready" -ne 1 ]; then
      log "tailscaled failed to start"
      if [ -f "$TAILSCALE_LOG_FILE" ]; then
        log "tailscaled log tail:"
        tail -n 80 "$TAILSCALE_LOG_FILE" | sed 's/^/[tailscaled] /'
      fi
      return 1
    fi
  fi

  local up_args=(
    "--socket=$TAILSCALE_SOCKET"
    "up"
    "--authkey=$TAILSCALE_AUTH_KEY"
    "--accept-routes=$TAILSCALE_ACCEPT_ROUTES"
  )

  if [ -n "$TAILSCALE_HOSTNAME" ]; then
    up_args+=("--hostname=$TAILSCALE_HOSTNAME")
  fi

  log "bringing tailscale up"
  local up_ok=0
  for _ in $(seq 1 8); do
    if tailscale "${up_args[@]}"; then
      up_ok=1
      break
    fi
    sleep 1
  done
  if [ "$up_ok" -ne 1 ]; then
    log "tailscale up failed after retries"
    if [ -f "$TAILSCALE_LOG_FILE" ]; then
      log "tailscaled log tail:"
      tail -n 80 "$TAILSCALE_LOG_FILE" | sed 's/^/[tailscaled] /'
    fi
    return 1
  fi

  log "tailscale status after up:"
  tailscale --socket="$TAILSCALE_SOCKET" status || true

  if [ "$TAILSCALE_ENABLE_PROXY_ENV" = "true" ]; then
    export ALL_PROXY="socks5://${TAILSCALE_SOCKS_ADDR}/"
    export HTTP_PROXY="http://${TAILSCALE_HTTP_PROXY_ADDR}/"
    export HTTPS_PROXY="http://${TAILSCALE_HTTP_PROXY_ADDR}/"
    export http_proxy="$HTTP_PROXY"
    export https_proxy="$HTTPS_PROXY"
    export NO_PROXY="${NO_PROXY:-127.0.0.1,localhost,::1}"
    export no_proxy="$NO_PROXY"
    log "exported proxy env vars via tailscale (socks=${TAILSCALE_SOCKS_ADDR}, http=${TAILSCALE_HTTP_PROXY_ADDR})"
  else
    # Ensure inherited proxy vars do not accidentally affect openclaw process.
    unset ALL_PROXY HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
    log "TAILSCALE_ENABLE_PROXY_ENV=false; proxy env vars are unset"
  fi
}

if [ -n "$TAILSCALE_AUTH_KEY" ]; then
  if ! install_tailscale_if_missing || ! start_tailscale; then
    if [ "$TAILSCALE_FATAL_ON_FAILURE" = "true" ]; then
      log "tailscale setup failed and TAILSCALE_FATAL_ON_FAILURE=true; exiting"
      exit 1
    fi
    log "tailscale setup failed; continuing without tailscale"
  fi
else
  log "TAILSCALE_AUTH_KEY not set; running without tailscale"
fi

exec "$@"
