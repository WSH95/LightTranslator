#!/bin/bash
# Run LightTranslator from the built .deb inside a container, on your desktop.
#
# The container shares the host X display, so the window appears on your real
# desktop and the global hotkey, clipboard and selection capture all work
# against your real session. Needed on Ubuntu 20.04 and older, where the app
# cannot run natively (no webkit2gtk-4.1/libsoup3).
#
#   ./scripts/docker-run.sh [start]   launch (default)
#   ./scripts/docker-run.sh update    rebuild the .deb, then relaunch
#   ./scripts/docker-run.sh stop      stop and revoke the X grant
#   ./scripts/docker-run.sh logs      recent app output
#   ./scripts/docker-run.sh shell     a shell inside the running container
#   ./scripts/docker-run.sh bake      freeze a self-contained versioned image
#
# Env: LT_DATA_VOLUME (default lighttranslator-data) — where settings/API keys
#      persist. WITH_OCR=0 builds the runtime image without Tesseract.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_IMAGE=lighttranslator-run:jammy
CONTAINER=lighttranslator
DATA_VOLUME="${LT_DATA_VOLUME:-lighttranslator-data}"
DEB_DIR="$REPO_ROOT/src-tauri/target/release/bundle/deb"
WITH_OCR="${WITH_OCR:-1}"

command -v docker >/dev/null || { echo "docker is required but not installed." >&2; exit 1; }

latest_deb() {
  find "$DEB_DIR" -maxdepth 1 -name '*.deb' -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | head -1 | cut -d' ' -f2-
}

ensure_image() {
  if ! docker image inspect "$RUN_IMAGE" >/dev/null 2>&1; then
    echo "==> Building runtime image (once; ~2 minutes)"
    docker build -t "$RUN_IMAGE" --build-arg "WITH_OCR=$WITH_OCR" \
      -f "$REPO_ROOT/docker/Dockerfile.run" "$REPO_ROOT/docker"
  fi
}

do_stop() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  xhost -SI:localuser:root >/dev/null 2>&1 || true
  echo "Stopped LightTranslator and revoked X access."
}

do_start() {
  local deb
  deb=$(latest_deb)
  if [ -z "$deb" ]; then
    echo "No .deb found in $DEB_DIR" >&2
    echo "Build one first:  npm run app:docker:build" >&2
    exit 1
  fi

  if [ "${XDG_SESSION_TYPE:-x11}" = "wayland" ]; then
    echo "This is a Wayland session. The container shares the X display, so the" >&2
    echo "app needs an X11 session (log in with 'Ubuntu on Xorg')." >&2
    exit 1
  fi
  [ -n "${DISPLAY:-}" ] || { echo "DISPLAY is not set — is this a graphical session?" >&2; exit 1; }

  ensure_image
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

  echo "==> Granting the container access to your X display"
  xhost +SI:localuser:root >/dev/null

  local dbus_args=()
  local runtime_bus="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/bus"
  if [ -S "$runtime_bus" ]; then
    dbus_args=(-v "$runtime_bus:/run/user/0/bus"
               -e "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/0/bus")
  fi

  echo "==> Starting $(basename "$deb")"
  docker run -d \
    --name "$CONTAINER" \
    --ipc=host \
    -e DISPLAY="$DISPLAY" \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    -v "$DEB_DIR:/opt/deb:ro" \
    -v "$DATA_VOLUME:/root/.local/share" \
    "${dbus_args[@]}" \
    "$RUN_IMAGE" \
    lighttranslator >/dev/null

  sleep 6
  if ! docker ps --filter "name=^/$CONTAINER$" --format '{{.Names}}' | grep -q "$CONTAINER"; then
    echo "The app exited. Recent output:" >&2
    docker logs --tail 30 "$CONTAINER" 2>&1 | grep -viE "arboard|TRACE" >&2
    exit 1
  fi

  cat <<EOM

LightTranslator is running on your desktop.

  Quick translate : select text anywhere, press Ctrl+Shift+X
  Settings        : gear icon — API keys persist in volume '$DATA_VOLUME'
  After a change  : npm run app:docker:update
  Stop            : npm run app:docker:stop
EOM
}

case "${1:-start}" in
  start)  do_start ;;
  stop)   do_stop ;;
  logs)   docker logs --tail 60 "$CONTAINER" 2>&1 | grep -viE "arboard|TRACE" ;;
  shell)  docker exec -it "$CONTAINER" bash ;;
  update)
    "$REPO_ROOT/scripts/docker-build-deb.sh"
    echo "==> Restarting with the new build"
    do_start
    ;;
  bake)
    # Self-contained image for archiving or copying to another machine.
    deb=$(latest_deb)
    [ -n "$deb" ] || { echo "No .deb to bake." >&2; exit 1; }
    version=$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo latest)
    ensure_image
    docker rm -f lighttranslator-bake >/dev/null 2>&1 || true
    docker run --name lighttranslator-bake -v "$DEB_DIR:/opt/deb:ro" \
      --entrypoint bash "$RUN_IMAGE" -c "dpkg -i /opt/deb/$(basename "$deb") >/dev/null"
    docker commit --change 'ENTRYPOINT ["lighttranslator"]' \
      lighttranslator-bake "lighttranslator:$version" >/dev/null
    docker rm lighttranslator-bake >/dev/null
    echo "Baked image: lighttranslator:$version"
    ;;
  *)
    echo "Usage: $0 [start|update|stop|logs|shell|bake]" >&2
    exit 1
    ;;
esac
