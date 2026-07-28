#!/bin/bash
# Live development loop inside the builder container: Vite HMR for the
# frontend, incremental Rust rebuilds for the backend, window on your real
# desktop. Makes Ubuntu 20.04 (and anything else without webkit2gtk-4.1) a
# usable development machine for this app.
#
#   ./scripts/docker-dev.sh
#
# Ctrl+C stops it. Nothing is packaged; use docker-build-deb.sh for a .deb.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_IMAGE=lighttranslator-build:jammy
CONTAINER=lighttranslator-dev
CARGO_VOLUME=lighttranslator-cargo
TARGET_VOLUME=lighttranslator-target

command -v docker >/dev/null || { echo "docker is required but not installed." >&2; exit 1; }
[ -n "${DISPLAY:-}" ] || { echo "DISPLAY is not set — is this a graphical session?" >&2; exit 1; }
if [ "${XDG_SESSION_TYPE:-x11}" = "wayland" ]; then
  echo "This is a Wayland session; the container needs an X11 session." >&2
  exit 1
fi

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  xhost -SI:localuser:root >/dev/null 2>&1 || true
  echo "Dev session stopped; X access revoked."
}
trap cleanup EXIT INT TERM

if ! docker image inspect "$BUILD_IMAGE" >/dev/null 2>&1; then
  echo "==> Building builder image (once)"
  docker build -t "$BUILD_IMAGE" -f "$REPO_ROOT/docker/Dockerfile.build" "$REPO_ROOT/docker"
fi

# The dev build needs the runtime tools too (hotkey capture, clipboard).
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
xhost +SI:localuser:root >/dev/null

echo "==> Starting dev session (first Rust build takes a few minutes)"
docker run --rm -i \
  --name "$CONTAINER" \
  --ipc=host \
  -e DISPLAY="$DISPLAY" \
  -e CARGO_TARGET_DIR=/opt/target \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v "$REPO_ROOT:/work" \
  -v "$CARGO_VOLUME:/opt/cargo" \
  -v "$TARGET_VOLUME:/opt/target" \
  -w /work \
  "$BUILD_IMAGE" \
  bash -c '
    set -e
    command -v xdotool >/dev/null || {
      apt-get update -qq && apt-get install -y -qq --no-install-recommends \
        xdotool xclip dbus-x11 > /dev/null
    }
    [ -d node_modules ] || npm install
    npx --yes @tauri-apps/cli@^2 dev
  '
