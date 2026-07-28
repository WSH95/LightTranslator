#!/bin/bash
# Build the .deb inside an Ubuntu 22.04 container.
#
# For hosts that cannot build natively (Ubuntu 20.04 and older lack
# webkit2gtk-4.1/libsoup3), and for anyone who wants a reproducible artifact.
# First build takes ~10 minutes; later builds reuse the cargo cache volumes
# and finish in ~2 minutes.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_IMAGE=lighttranslator-build:jammy
CARGO_VOLUME=lighttranslator-cargo
TARGET_VOLUME=lighttranslator-target
CONTAINER=lighttranslator-build
DEB_DIR="$REPO_ROOT/src-tauri/target/release/bundle/deb"

command -v docker >/dev/null || { echo "docker is required but not installed." >&2; exit 1; }

echo "==> Building builder image (cached after the first run)"
docker build -q -t "$BUILD_IMAGE" -f "$REPO_ROOT/docker/Dockerfile.build" "$REPO_ROOT/docker" >/dev/null

# The frontend bundle must exist before the Rust build: tauri's
# generate_context! macro fails with "frontendDist ... doesn't exist".
echo "==> Building frontend bundle"
if command -v npm >/dev/null; then
  (cd "$REPO_ROOT" && npm run build)
else
  docker run --rm -v "$REPO_ROOT:/work" -w /work "$BUILD_IMAGE" npm run build
fi

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo "==> Building .deb (Rust release build)"
# beforeBuildCommand is cleared because dist/ is already built above;
# otherwise the CLI rebuilds the frontend inside the container.
docker run --rm --name "$CONTAINER" \
  -v "$REPO_ROOT:/work" \
  -v "$CARGO_VOLUME:/opt/cargo" \
  -v "$TARGET_VOLUME:/opt/target" \
  -w /work \
  "$BUILD_IMAGE" \
  bash -c '
    set -e
    npx --yes @tauri-apps/cli@^2 build --bundles deb \
      --config "{\"build\":{\"beforeBuildCommand\":\"\"}}"
    mkdir -p /work/src-tauri/target/release/bundle/deb
    cp /opt/target/release/bundle/deb/*.deb /work/src-tauri/target/release/bundle/deb/
    # The container writes as root; hand the generated files back to the host user.
    chown -R '"$(id -u):$(id -g)"' \
      /work/src-tauri/target/release/bundle/deb \
      /work/src-tauri/gen 2>/dev/null || true
    chown '"$(id -u):$(id -g)"' /work/src-tauri/Cargo.lock 2>/dev/null || true
  '

DEB=$(find "$DEB_DIR" -maxdepth 1 -name '*.deb' -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -1 | cut -d' ' -f2-)
if [ -z "$DEB" ]; then
  echo "Build finished but no .deb was produced." >&2
  exit 1
fi

echo
echo "Built: $DEB"
echo "  Install natively on Ubuntu 22.04+/Debian 12+:  sudo apt install $DEB"
echo "  Or run it here (any host, incl. Ubuntu 20.04): npm run app:docker"
