#!/usr/bin/env bash
# Download a static macOS ffmpeg into src-tauri/resources/ffmpeg so capture
# works on machines without a system ffmpeg (required by @screenpipe/sdk).
# Uses the same arm64 build ffmpeg-sidecar auto-downloads.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DEST="${ROOT}/src-tauri/resources/ffmpeg"
CACHE="${ROOT}/.cache/ffmpeg"
STAMP="${DEST}/.jarbas-ffmpeg-version"

uname_m="$(uname -m)"
case "${uname_m}" in
  arm64)
    ARCH="arm64"
    VERSION="8.0-osxexperts"
    URL="https://www.osxexperts.net/ffmpeg80arm.zip"
    ;;
  x86_64)
    ARCH="x86_64"
    VERSION="8.0-osxexperts"
    URL="https://www.osxexperts.net/ffmpeg80intel.zip"
    ;;
  *)
    echo "error: unsupported macOS arch: ${uname_m}" >&2
    exit 1
    ;;
esac

if [ -x "${DEST}/bin/ffmpeg" ] \
  && [ -f "${STAMP}" ] \
  && [ "$(cat "${STAMP}")" = "${VERSION}-${ARCH}" ]; then
  echo "Bundled ffmpeg ${VERSION} (${ARCH}) already present."
  exit 0
fi

mkdir -p "${CACHE}" "${DEST}/bin"
ZIP="${CACHE}/ffmpeg-${VERSION}-${ARCH}.zip"

if [ ! -f "${ZIP}" ]; then
  echo "Fetching ffmpeg ${VERSION} (${ARCH})…"
  curl -fsSL --retry 3 -o "${ZIP}.partial" "${URL}"
  mv "${ZIP}.partial" "${ZIP}"
fi

TMP="$(mktemp -d "${CACHE}/extract.XXXXXX")"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

unzip -qo "${ZIP}" -d "${TMP}"
FOUND="$(find "${TMP}" -type f -name ffmpeg | head -1 || true)"
if [[ -z "${FOUND}" ]]; then
  echo "error: zip did not contain an ffmpeg binary: ${URL}" >&2
  exit 1
fi

install -m 755 "${FOUND}" "${DEST}/bin/ffmpeg"
# Some zips also ship ffprobe; include it when present (harmless, useful later).
FFPROBE="$(find "${TMP}" -type f -name ffprobe | head -1 || true)"
if [[ -n "${FFPROBE}" ]]; then
  install -m 755 "${FFPROBE}" "${DEST}/bin/ffprobe"
fi

echo "${VERSION}-${ARCH}" > "${STAMP}"
"${DEST}/bin/ffmpeg" -version | head -1
echo "Bundled ffmpeg → ${DEST}/bin/ffmpeg"
