#!/usr/bin/env bash
# Stage @screenpipe/sdk (+ platform native addon) into src-tauri/resources
# so release builds do not depend on the developer's node_modules path.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
SRC_SDK="${ROOT}/node_modules/@screenpipe/sdk"
DEST_ROOT="${ROOT}/src-tauri/resources/screenpipe/node_modules/@screenpipe"
DEST_SDK="${DEST_ROOT}/sdk"

uname_m="$(uname -m)"
case "${uname_m}" in
  arm64) NATIVE_PKG="sdk-darwin-arm64" ;;
  x86_64) NATIVE_PKG="sdk-darwin-x64" ;;
  *)
    echo "error: unsupported macOS arch: ${uname_m}" >&2
    exit 1
    ;;
esac

SRC_NATIVE="${ROOT}/node_modules/@screenpipe/${NATIVE_PKG}"
DEST_NATIVE="${DEST_ROOT}/${NATIVE_PKG}"

if [[ ! -d "$SRC_SDK" ]]; then
  echo "error: missing ${SRC_SDK} — run npm install first." >&2
  exit 1
fi
if [[ ! -d "$SRC_NATIVE" ]]; then
  echo "error: missing ${SRC_NATIVE} — run npm install first." >&2
  exit 1
fi

echo "→ Staging @screenpipe/sdk + @screenpipe/${NATIVE_PKG}"
rm -rf "${ROOT}/src-tauri/resources/screenpipe"
mkdir -p "$DEST_ROOT"
# Prefer rsync when available (fast + excludes junk); fall back to ditto.
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude 'examples' \
    --exclude 'docs' \
    --exclude 'Sources' \
    --exclude '__test__' \
    --exclude '.git' \
    "$SRC_SDK/" "$DEST_SDK/"
  rsync -a --delete "$SRC_NATIVE/" "$DEST_NATIVE/"
else
  ditto "$SRC_SDK" "$DEST_SDK"
  ditto "$SRC_NATIVE" "$DEST_NATIVE"
fi

test -f "$DEST_SDK/bridges/node-json-session.mjs"
test -f "$DEST_SDK/package.json"
test -d "$DEST_NATIVE"

echo "Staged screenpipe SDK under src-tauri/resources/screenpipe"
