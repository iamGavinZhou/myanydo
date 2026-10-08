#!/bin/bash
# Build build/icon.icns from build/icon.svg using stock macOS tools.
set -euo pipefail
cd "$(dirname "$0")/.."

ICONSET=build/icon.iconset
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

if [ ! -f build/icon.svg.png ] || [ build/icon.svg -nt build/icon.svg.png ]; then
  echo "Rendering icon.svg → PNG (qlmanage)…"
  qlmanage -t -s 1024 -o build build/icon.svg >/dev/null
fi

cp build/icon.svg.png "$ICONSET/icon_512x512@2x.png"

make_size () {
  sips -z "$1" "$1" build/icon.svg.png --out "$ICONSET/icon_${2}.png" >/dev/null
}
make_size 16    "16x16"
make_size 32    "16x16@2x"
make_size 32    "32x32"
make_size 64    "32x32@2x"
make_size 128   "128x128"
make_size 256   "128x128@2x"
make_size 256   "256x256"
make_size 512   "256x256@2x"
make_size 512   "512x512"

iconutil -c icns "$ICONSET" -o build/icon.icns
rm -rf "$ICONSET"
echo "OK → build/icon.icns"
