#!/usr/bin/env bash
# Stage @screenpipe/sdk (+ platform native addon) into src-tauri/resources
# so release builds do not depend on the developer's node_modules path.
# Supports macOS, Linux (if available), and Windows (Git Bash / CI).
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
SRC_SDK="${ROOT}/node_modules/@screenpipe/sdk"
DEST_ROOT="${ROOT}/src-tauri/resources/screenpipe/node_modules/@screenpipe"
DEST_SDK="${DEST_ROOT}/sdk"

OS="$(uname -s)"
ARCH_RAW="$(uname -m)"

case "${OS}" in
  Darwin)
    case "${ARCH_RAW}" in
      arm64) NATIVE_PKG="sdk-darwin-arm64" ;;
      x86_64) NATIVE_PKG="sdk-darwin-x64" ;;
      *)
        echo "error: unsupported macOS arch: ${ARCH_RAW}" >&2
        exit 1
        ;;
    esac
    ;;
  Linux)
    case "${ARCH_RAW}" in
      aarch64|arm64) NATIVE_PKG="sdk-linux-arm64-gnu" ;;
      x86_64) NATIVE_PKG="sdk-linux-x64-gnu" ;;
      *)
        echo "error: unsupported Linux arch: ${ARCH_RAW}" >&2
        exit 1
        ;;
    esac
    ;;
  MINGW*|MSYS*|CYGWIN*)
    case "${ARCH_RAW}" in
      aarch64|arm64) NATIVE_PKG="sdk-win32-arm64-msvc" ;;
      *) NATIVE_PKG="sdk-win32-x64-msvc" ;;
    esac
    ;;
  *)
    echo "error: unsupported OS: ${OS}" >&2
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
  echo "→ Installing @screenpipe/${NATIVE_PKG}…"
  (
    cd "${ROOT}"
    npm install --no-save --no-audit --no-fund "@screenpipe/${NATIVE_PKG}@$(node -p "require('./node_modules/@screenpipe/sdk/package.json').version")"
  )
fi

if [[ ! -d "$SRC_NATIVE" ]]; then
  echo "error: missing ${SRC_NATIVE} after install attempt." >&2
  exit 1
fi

echo "→ Staging @screenpipe/sdk + @screenpipe/${NATIVE_PKG}"
rm -rf "${ROOT}/src-tauri/resources/screenpipe"
mkdir -p "$DEST_ROOT"

copy_tree() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude 'examples' \
      --exclude 'docs' \
      --exclude 'Sources' \
      --exclude '__test__' \
      --exclude '.git' \
      "$src/" "$dest/"
  elif command -v ditto >/dev/null 2>&1; then
    ditto "$src" "$dest"
  else
    cp -R "$src/." "$dest/"
  fi
}

copy_tree "$SRC_SDK" "$DEST_SDK"
copy_tree "$SRC_NATIVE" "$DEST_NATIVE"

test -f "$DEST_SDK/bridges/node-json-session.mjs"
test -f "$DEST_SDK/package.json"
test -d "$DEST_NATIVE"

echo "Staged screenpipe SDK under src-tauri/resources/screenpipe"
