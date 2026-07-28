#!/bin/bash
# Installs the .deb mounted at /opt/deb, then runs the app. Keeping the
# install here (rather than baking it into the image) is what makes updates
# cheap: a new build only needs a container restart.
set -e

DEB=$(find /opt/deb -maxdepth 1 -name '*.deb' -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -1 | cut -d' ' -f2-)
if [ -z "$DEB" ]; then
  echo "No .deb found in /opt/deb — build one first (npm run app:docker:build)." >&2
  exit 1
fi

echo "Installing $(basename "$DEB")..."
dpkg -i "$DEB" > /dev/null
echo "Installed: $(dpkg-query -W -f='${Package} ${Version}' light-translator 2>/dev/null || echo unknown)"

exec "$@"
