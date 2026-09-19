#!/bin/sh
# Make the GNOME Shell placement extension visible to the shell. The app itself
# enables it for the user on first run; GNOME only discovers extensions when the
# shell starts, so a fresh install may need one log out / log in.
set -e
UUID="lighttranslator@lighttranslator.app"
SRC="/opt/LightTranslator/resources/gnome-extension/$UUID"
DEST="/usr/share/gnome-shell/extensions/$UUID"

if [ -f "$SRC/metadata.json" ]; then
  mkdir -p "$DEST"
  cp -f "$SRC/metadata.json" "$SRC/extension.js" "$DEST/"
fi
exit 0
