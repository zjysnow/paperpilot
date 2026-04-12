#!/bin/bash
set -e

PLUGIN_NAME="paperpilot"
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
XPI_FILE="${PLUGIN_NAME}-${VERSION}.xpi"

rm -f "$XPI_FILE"

zip -r "$XPI_FILE" \
  manifest.json \
  bootstrap.js \
  main.js \
  prefs.js \
  preferences.xhtml \
  locale/ \
  -x "*.DS_Store" "build.sh" "*.xpi" "README.md"

echo "Built: $XPI_FILE"
