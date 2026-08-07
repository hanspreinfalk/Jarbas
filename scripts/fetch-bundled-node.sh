#!/usr/bin/env bash
# Download an official Node.js build into src-tauri/resources/nodejs
# so the app ships its own runtime (no system Node required).
# Supports macOS, Linux, and Windows (Git Bash / CI).
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
NODE_VERSION="${NODE_VERSION:-22.17.0}"
DEST="${ROOT}/src-tauri/resources/nodejs"
CACHE="${ROOT}/.cache/node-runtime"
STAMP="${DEST}/.jarbas-node-version"

OS="$(uname -s)"
ARCH_RAW="$(uname -m)"

case "${OS}" in
  Darwin)
    case "${ARCH_RAW}" in
      arm64) NODE_ARCH="darwin-arm64" ;;
      x86_64) NODE_ARCH="darwin-x64" ;;
      *)
        echo "error: unsupported macOS arch: ${ARCH_RAW}" >&2
        exit 1
        ;;
    esac
    ARCHIVE="node-v${NODE_VERSION}-${NODE_ARCH}.tar.gz"
    EXTRACT="tar"
    ;;
  Linux)
    case "${ARCH_RAW}" in
      aarch64|arm64) NODE_ARCH="linux-arm64" ;;
      x86_64) NODE_ARCH="linux-x64" ;;
      *)
        echo "error: unsupported Linux arch: ${ARCH_RAW}" >&2
        exit 1
        ;;
    esac
    ARCHIVE="node-v${NODE_VERSION}-${NODE_ARCH}.tar.gz"
    EXTRACT="tar"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    case "${ARCH_RAW}" in
      aarch64|arm64) NODE_ARCH="win-arm64" ;;
      x86_64|i686|i386) NODE_ARCH="win-x64" ;;
      *)
        # Windows Git Bash often reports x86_64 even on ARM via emulation.
        NODE_ARCH="win-x64"
        ;;
    esac
    ARCHIVE="node-v${NODE_VERSION}-${NODE_ARCH}.zip"
    EXTRACT="zip"
    ;;
  *)
    echo "error: unsupported OS: ${OS}" >&2
    exit 1
    ;;
esac

URL="https://nodejs.org/dist/v${NODE_VERSION}/${ARCHIVE}"
SHA_URL="https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
PREFIX="${CACHE}/node-v${NODE_VERSION}-${NODE_ARCH}"

node_bin() {
  if [[ "${NODE_ARCH}" == win-* ]]; then
    echo "${DEST}/bin/node.exe"
  else
    echo "${DEST}/bin/node"
  fi
}

NODE_BIN="$(node_bin)"

if [[ -f "${NODE_BIN}" ]] \
  && [[ -f "${DEST}/lib/node_modules/npm/bin/npm-cli.js" ]] \
  && [[ -f "${STAMP}" ]] \
  && [[ "$(cat "${STAMP}")" = "${NODE_VERSION}-${NODE_ARCH}" ]]; then
  echo "Bundled Node ${NODE_VERSION} (${NODE_ARCH}) already present."
  exit 0
fi

mkdir -p "${CACHE}"

if [[ ! -f "${PREFIX}/bin/node" && ! -f "${PREFIX}/node.exe" ]]; then
  echo "Fetching Node ${NODE_VERSION} (${NODE_ARCH})…"
  TMP="$(mktemp -d "${CACHE}/fetch.XXXXXX")"
  cleanup() { rm -rf "${TMP}"; }
  trap cleanup EXIT

  curl -fsSL "${URL}" -o "${TMP}/${ARCHIVE}"
  curl -fsSL "${SHA_URL}" -o "${TMP}/SHASUMS256.txt"
  EXPECTED_SHA="$(awk -v name="${ARCHIVE}" '$2 == name { print $1; exit }' "${TMP}/SHASUMS256.txt")"
  if [[ -z "${EXPECTED_SHA}" ]]; then
    echo "error: could not find checksum for ${ARCHIVE}" >&2
    exit 1
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_SHA="$(sha256sum "${TMP}/${ARCHIVE}" | awk '{print $1}')"
  else
    ACTUAL_SHA="$(shasum -a 256 "${TMP}/${ARCHIVE}" | awk '{print $1}')"
  fi
  if [[ "${ACTUAL_SHA}" != "${EXPECTED_SHA}" ]]; then
    echo "error: Node archive checksum mismatch" >&2
    echo "  expected ${EXPECTED_SHA}" >&2
    echo "  actual   ${ACTUAL_SHA}" >&2
    exit 1
  fi

  rm -rf "${PREFIX}"
  mkdir -p "${CACHE}"
  if [[ "${EXTRACT}" == "zip" ]]; then
    unzip -qo "${TMP}/${ARCHIVE}" -d "${CACHE}"
  else
    tar -xzf "${TMP}/${ARCHIVE}" -C "${CACHE}"
  fi
  trap - EXIT
  cleanup
fi

echo "Installing bundled Node into ${DEST}…"
rm -rf "${DEST}"
mkdir -p "${DEST}/bin" "${DEST}/lib/node_modules"

if [[ "${NODE_ARCH}" == win-* ]]; then
  # Official Windows zip lays out node.exe / npm at the root of the extracted folder.
  SRC="${PREFIX}"
  if [[ ! -f "${SRC}/node.exe" ]]; then
    # Some archives nest under node-v…/ 
    SRC="$(find "${CACHE}" -maxdepth 2 -type f -name node.exe | head -1 | xargs dirname)"
  fi
  cp "${SRC}/node.exe" "${DEST}/bin/node.exe"
  if [[ -d "${SRC}/node_modules/npm" ]]; then
    cp -R "${SRC}/node_modules/npm" "${DEST}/lib/node_modules/npm"
  elif [[ -d "${SRC}/lib/node_modules/npm" ]]; then
    cp -R "${SRC}/lib/node_modules/npm" "${DEST}/lib/node_modules/npm"
  else
    echo "error: npm missing from Node Windows archive" >&2
    exit 1
  fi
  # npm.cmd shim for Windows PATH consumers
  cat > "${DEST}/bin/npm.cmd" <<'EOF'
@echo off
setlocal
set ROOT=%~dp0..
"%ROOT%\bin\node.exe" "%ROOT%\lib\node_modules\npm\bin\npm-cli.js" %*
EOF
  cat > "${DEST}/bin/npx.cmd" <<'EOF'
@echo off
setlocal
set ROOT=%~dp0..
"%ROOT%\bin\node.exe" "%ROOT%\lib\node_modules\npm\bin\npx-cli.js" %*
EOF
else
  cp "${PREFIX}/bin/node" "${DEST}/bin/node"
  cp -R "${PREFIX}/lib/node_modules/npm" "${DEST}/lib/node_modules/npm"
  if [[ -f "${PREFIX}/LICENSE" ]]; then
    cp "${PREFIX}/LICENSE" "${DEST}/LICENSE"
  fi

  # Drop docs / Windows shims; invoke npm as `node npm-cli.js`.
  rm -rf \
    "${DEST}/lib/node_modules/npm/man" \
    "${DEST}/lib/node_modules/npm/docs" \
    "${DEST}/lib/node_modules/npm/html"
  find "${DEST}" -type d -name 'node-gyp-bin' -prune -exec rm -rf {} + 2>/dev/null || true
  find "${DEST}" \( -name '*.cmd' -o -name '*.ps1' -o -name '*.bat' \) -delete 2>/dev/null || true
  find "${DEST}" -type f -exec chmod a-x {} + 2>/dev/null || true
  chmod a+x "${DEST}/bin/node"

  cat > "${DEST}/bin/npm" <<'EOF'
#!/bin/sh
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
exec "$ROOT/bin/node" "$ROOT/lib/node_modules/npm/bin/npm-cli.js" "$@"
EOF
  cat > "${DEST}/bin/npx" <<'EOF'
#!/bin/sh
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
exec "$ROOT/bin/node" "$ROOT/lib/node_modules/npm/bin/npx-cli.js" "$@"
EOF
  chmod a+x "${DEST}/bin/npm" "${DEST}/bin/npx"
fi

if [[ ! -f "${NODE_BIN}" ]]; then
  echo "error: bundled node missing at ${NODE_BIN}" >&2
  exit 1
fi
if [[ ! -f "${DEST}/lib/node_modules/npm/bin/npm-cli.js" ]]; then
  echo "error: bundled npm-cli.js missing" >&2
  exit 1
fi

# Smoke test the binary.
"${NODE_BIN}" -e 'process.exit(0)'

printf '%s\n' "${NODE_VERSION}-${NODE_ARCH}" > "${STAMP}"
echo "Bundled Node ${NODE_VERSION} (${NODE_ARCH}) ready."
