#!/bin/sh
# Regenerates azul-code app and menu-bar icons from the SVG sources.
#
# Requires rsvg-convert (brew install librsvg) and macOS iconutil.
set -eu

cd "$(dirname "$0")/.."
full="resources/icon.svg"
small="resources/icon-small.svg"
iconset="build/icon.iconset"

command -v rsvg-convert >/dev/null || { echo "rsvg-convert not found: brew install librsvg" >&2; exit 1; }

rm -rf "$iconset"
mkdir -p "$iconset"

# name                pixels  source
set -- \
  "icon_16x16.png        16    $small" \
  "icon_16x16@2x.png     32    $small" \
  "icon_32x32.png        32    $small" \
  "icon_32x32@2x.png     64    $small" \
  "icon_128x128.png     128    $full" \
  "icon_128x128@2x.png  256    $full" \
  "icon_256x256.png     256    $full" \
  "icon_256x256@2x.png  512    $full" \
  "icon_512x512.png     512    $full" \
  "icon_512x512@2x.png 1024    $full"

for entry in "$@"; do
  # shellcheck disable=SC2086
  set -- $entry
  rsvg-convert -w "$2" -h "$2" -o "$iconset/$1" "$3"
done

rsvg-convert -w 1024 -h 1024 -o resources/icon.png "$full"
iconutil -c icns -o build/icon.icns "$iconset"
rsvg-convert -w 18 -h 18 -o resources/trayTemplate.png resources/tray.svg
rsvg-convert -w 36 -h 36 -o resources/trayTemplate@2x.png resources/tray.svg
echo "icons regenerated"
