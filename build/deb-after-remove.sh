#!/bin/sh
# Remove the extension files this package installed. A per-user copy and the
# user's enabled-extensions setting are deliberately left alone.
set -e
UUID="lighttranslator@lighttranslator.app"
DEST="/usr/share/gnome-shell/extensions/$UUID"

case "$1" in
  remove|purge)
    rm -f "$DEST/metadata.json" "$DEST/extension.js"
    rmdir "$DEST" 2>/dev/null || true
    ;;
esac
exit 0
