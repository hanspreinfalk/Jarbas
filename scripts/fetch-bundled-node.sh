#!/usr/bin/env bash
# Download an official Node.js macOS build into src-tauri/resources/nodejs
# so the app ships its own runtime (no system Node required).
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
NODE_VERSION="${NODE_VERSION:-22.17.0}"
DEST="${ROOT}/src-tauri/resources/nodejs"
CACHE="${ROOT}/.cache/node-runtime"
STAMP="${DEST}/.jarbas-node-version"

uname_m="$(uname -m)"
case "${uname_m}" in
  arm64) NODE_ARCH="darwin-arm64" ;;
  x86_64) NODE_ARCH="darwin-x64" ;;
  *)
    echo "error: unsupported macOS arch: ${uname_m}" >&2
    exit 1
    ;;
esac

TARBALL="node-v${NODE_VERSION}-${NODE_ARCH}.tar.gz"
URL="https://nodejs.org/dist/v${NODE_VERSION}/${TARBALL}"
SHA_URL="https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
PREFIX="${CACHE}/node-v${NODE_VERSION}-${NODE_ARCH}"

if [ -x "${DEST}/bin/node" ] \
  && [ -x "${DEST}/bin/npm" ] \
  && [ -f "${DEST}/lib/node_modules/npm/bin/npm-cli.js" ] \
  && [ -f "${STAMP}" ] \
  && [ "$(cat "${STAMP}")" = "${NODE_VERSION}-${NODE_ARCH}" ]; then
  echo "Bundled Node ${NODE_VERSION} (${NODE_ARCH}) already present."
  exit 0
fi

mkdir -p "${CACHE}"

if [ ! -x "${PREFIX}/bin/node" ]; then
  echo "Fetching Node ${NODE_VERSION} (${NODE_ARCH})…"
  TMP="$(mktemp -d "${CACHE}/fetch.XXXXXX")"
  cleanup() { rm -rf "${TMP}"; }
  trap cleanup EXIT

  curl -fsSL "${URL}" -o "${TMP}/${TARBALL}"
  curl -fsSL "${SHA_URL}" -o "${TMP}/SHASUMS256.txt"
  EXPECTED_SHA="$(awk -v name="${TARBALL}" '$2 == name { print $1; exit }' "${TMP}/SHASUMS256.txt")"
  if [ -z "${EXPECTED_SHA}" ]; then
    echo "error: could not find checksum for ${TARBALL}" >&2
    exit 1
  fi
  ACTUAL_SHA="$(shasum -a 256 "${TMP}/${TARBALL}" | awk '{print $1}')"
  if [ "${ACTUAL_SHA}" != "${EXPECTED_SHA}" ]; then
    echo "error: Node tarball checksum mismatch" >&2
    echo "  expected ${EXPECTED_SHA}" >&2
    echo "  actual   ${ACTUAL_SHA}" >&2
    exit 1
  fi

  rm -rf "${PREFIX}"
  tar -xzf "${TMP}/${TARBALL}" -C "${CACHE}"
  trap - EXIT
  cleanup
fi

echo "Installing bundled Node into ${DEST}…"
rm -rf "${DEST}"
mkdir -p "${DEST}/bin" "${DEST}/lib/node_modules"
cp "${PREFIX}/bin/node" "${DEST}/bin/node"
cp -R "${PREFIX}/lib/node_modules/npm" "${DEST}/lib/node_modules/npm"
if [ -f "${PREFIX}/LICENSE" ]; then
  cp "${PREFIX}/LICENSE" "${DEST}/LICENSE"
fi

# Drop docs / Windows shims; invoke npm as `node npm-cli.js`.
rm -rf \
  "${DEST}/lib/node_modules/npm/man" \
  "${DEST}/lib/node_modules/npm/docs" \
  "${DEST}/lib/node_modules/npm/html"
find "${DEST}" -type d -name 'node-gyp-bin' -prune -exec rm -rf {} +
find "${DEST}" \( -name '*.cmd' -o -name '*.ps1' -o -name '*.bat' \) -delete
find "${DEST}" -type f -exec chmod a-x {} +
chmod a+x "${DEST}/bin/node"

# Pi and npm spawn `npm` from PATH. Official tarballs ship a bin/npm shim;
# we recreate a tiny one that always uses this tree's node + npm-cli.js.
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

if [ ! -x "${DEST}/bin/node" ]; then
  echo "error: bundled node missing at ${DEST}/bin/node" >&2
  exit 1
fi
if [ ! -x "${DEST}/bin/npm" ]; then
  echo "error: bundled npm shim missing at ${DEST}/bin/npm" >&2
  exit 1
fi
if [ ! -f "${DEST}/lib/node_modules/npm/bin/npm-cli.js" ]; then
  echo "error: bundled npm-cli.js missing" >&2
  exit 1
fi

# Smoke test the binary + npm shim.
"${DEST}/bin/node" -e 'process.exit(0)'
"${DEST}/bin/npm" --version >/dev/null

printf '%s\n' "${NODE_VERSION}-${NODE_ARCH}" > "${STAMP}"
echo "Bundled Node ${NODE_VERSION} (${NODE_ARCH}) ready."
