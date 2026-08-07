#!/usr/bin/env bash
# Download a static ffmpeg into src-tauri/resources/ffmpeg so capture
# works on machines without a system ffmpeg (required by @screenpipe/sdk).
# Supports macOS, Linux, and Windows (Git Bash / CI).
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DEST="${ROOT}/src-tauri/resources/ffmpeg"
CACHE="${ROOT}/.cache/ffmpeg"
STAMP="${DEST}/.jarbas-ffmpeg-version"

OS="$(uname -s)"
ARCH_RAW="$(uname -m)"

case "${OS}" in
  Darwin)
    case "${ARCH_RAW}" in
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
        echo "error: unsupported macOS arch: ${ARCH_RAW}" >&2
        exit 1
        ;;
    esac
    BIN_NAME="ffmpeg"
    ;;
  Linux)
    case "${ARCH_RAW}" in
      aarch64|arm64)
        ARCH="linux-arm64"
        VERSION="7.1-johnvansickle"
        URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
        ;;
      x86_64)
        ARCH="linux-amd64"
        VERSION="7.1-johnvansickle"
        URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
        ;;
      *)
        echo "error: unsupported Linux arch: ${ARCH_RAW}" >&2
        exit 1
        ;;
    esac
    BIN_NAME="ffmpeg"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    ARCH="win64"
    VERSION="7.1-gyan-essentials"
    URL="https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    BIN_NAME="ffmpeg.exe"
    ;;
  *)
    echo "error: unsupported OS: ${OS}" >&2
    exit 1
    ;;
esac

DEST_BIN="${DEST}/bin/${BIN_NAME}"

if [[ -f "${DEST_BIN}" ]] \
  && [[ -f "${STAMP}" ]] \
  && [[ "$(cat "${STAMP}")" = "${VERSION}-${ARCH}" ]]; then
  echo "Bundled ffmpeg ${VERSION} (${ARCH}) already present."
  exit 0
fi

mkdir -p "${CACHE}" "${DEST}/bin"
ARCHIVE_NAME="$(basename "${URL}")"
ARCHIVE="${CACHE}/${ARCHIVE_NAME}"

if [[ ! -f "${ARCHIVE}" ]]; then
  echo "Fetching ffmpeg ${VERSION} (${ARCH})…"
  curl -fsSL --retry 3 -o "${ARCHIVE}.partial" "${URL}"
  mv "${ARCHIVE}.partial" "${ARCHIVE}"
fi

TMP="$(mktemp -d "${CACHE}/extract.XXXXXX")"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

case "${ARCHIVE_NAME}" in
  *.tar.xz)
    tar -xJf "${ARCHIVE}" -C "${TMP}"
    ;;
  *.zip)
    unzip -qo "${ARCHIVE}" -d "${TMP}"
    ;;
  *)
    echo "error: unknown archive type: ${ARCHIVE_NAME}" >&2
    exit 1
    ;;
esac

FOUND="$(find "${TMP}" -type f \( -name ffmpeg -o -name ffmpeg.exe \) | head -1 || true)"
if [[ -z "${FOUND}" ]]; then
  echo "error: archive did not contain an ffmpeg binary: ${URL}" >&2
  exit 1
fi

cp "${FOUND}" "${DEST_BIN}"
chmod a+x "${DEST_BIN}" 2>/dev/null || true

FFPROBE_SRC="$(find "${TMP}" -type f \( -name ffprobe -o -name ffprobe.exe \) | head -1 || true)"
if [[ -n "${FFPROBE_SRC}" ]]; then
  FFPROBE_NAME="$(basename "${FFPROBE_SRC}")"
  cp "${FFPROBE_SRC}" "${DEST}/bin/${FFPROBE_NAME}"
  chmod a+x "${DEST}/bin/${FFPROBE_NAME}" 2>/dev/null || true
fi

echo "${VERSION}-${ARCH}" > "${STAMP}"
"${DEST_BIN}" -version | head -1
echo "Bundled ffmpeg → ${DEST_BIN}"
