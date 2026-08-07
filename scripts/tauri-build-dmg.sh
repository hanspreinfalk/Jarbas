#!/usr/bin/env bash
# Build a signed + notarized macOS DMG that works on other Macs.
# Deep-signs nested Mach-O binaries (bundled Node) with the same Developer ID.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: missing .env — copy .env.example and fill Apple signing vars." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${APPLE_SIGNING_IDENTITY:-}" && -n "${CSC_NAME:-}" ]]; then
  export APPLE_SIGNING_IDENTITY="Developer ID Application: ${CSC_NAME}"
fi

# Tauri expects APPLE_PASSWORD for notarization auth.
if [[ -z "${APPLE_PASSWORD:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
  export APPLE_PASSWORD="$APPLE_APP_SPECIFIC_PASSWORD"
fi

missing=()
for key in APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
  if [[ -z "${!key:-}" ]]; then
    missing+=("$key")
  fi
done
if ((${#missing[@]})); then
  echo "error: missing required env vars in .env: ${missing[*]}" >&2
  exit 1
fi

ENTITLEMENTS="$ROOT/src-tauri/entitlements.plist"
if [[ ! -f "$ENTITLEMENTS" ]]; then
  echo "error: missing $ENTITLEMENTS" >&2
  exit 1
fi

MACOS_DIR="$ROOT/src-tauri/target/release/bundle/macos"
DMG_DIR="$ROOT/src-tauri/target/release/bundle/dmg"
mkdir -p "$DMG_DIR"

sign_macho_tree() {
  local app="$1"
  echo "→ Deep-signing nested Mach-O binaries in $(basename "$app")"
  while IFS= read -r -d '' file; do
    if file -b "$file" | grep -q 'Mach-O'; then
      echo "  sign: ${file#"$app/"}"
      codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$APPLE_SIGNING_IDENTITY" \
        "$file"
    fi
  done < <(find "$app/Contents" -type f -print0)

  echo "→ Signing app bundle"
  codesign --force --deep --options runtime --timestamp \
    --entitlements "$ENTITLEMENTS" \
    --sign "$APPLE_SIGNING_IDENTITY" \
    "$app"

  codesign --verify --deep --strict --verbose=2 "$app"
}

echo "→ Building app bundle (identity: $APPLE_SIGNING_IDENTITY)"
npm run fetch-node
npm run fetch-ffmpeg
npm run stage-screenpipe
# Let our script deep-sign + notarize; unset Apple notarization env so Tauri
# does not submit an unsigned nested .node binary mid-bundle.
env -u APPLE_ID -u APPLE_PASSWORD -u APPLE_APP_SPECIFIC_PASSWORD -u APPLE_TEAM_ID \
  -u APPLE_API_KEY -u APPLE_API_ISSUER -u APPLE_API_KEY_PATH \
  npx tauri build --bundles app

APP="$(find "$MACOS_DIR" -maxdepth 1 -name '*.app' | head -1 || true)"
if [[ -z "${APP:-}" || ! -d "$APP" ]]; then
  echo "error: .app not found in $MACOS_DIR" >&2
  exit 1
fi

PRODUCT="$(basename "$APP" .app)"
DMG="$DMG_DIR/${PRODUCT}_0.1.0_aarch64.dmg"

sign_macho_tree "$APP"

echo "→ Notarizing app"
APP_ZIP="$(mktemp -t jarbas-app).zip"
ditto -c -k --keepParent "$APP" "$APP_ZIP"
xcrun notarytool submit "$APP_ZIP" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
rm -f "$APP_ZIP"
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
spctl -a -vv "$APP"

echo "→ Creating DMG"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
ditto "$APP" "$STAGE/$PRODUCT.app"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG"
hdiutil create \
  -volname "$PRODUCT" \
  -srcfolder "$STAGE" \
  -ov \
  -format UDZO \
  "$DMG"

echo "→ Signing DMG"
codesign --force --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$DMG"

echo "→ Notarizing DMG"
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

echo "→ Stapling DMG"
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
spctl -a -vv -t install "$DMG"

echo
echo "Notarized DMG ready for other Macs (Apple Silicon):"
ls -lh "$DMG"
echo "$DMG"
echo
echo "Install on the other Mac:"
echo "  1. Copy the DMG over (AirDrop / USB / download)"
echo "  2. Open the DMG"
echo "  3. Drag Jarbas into Applications"
echo "  4. Eject the DMG"
echo "  5. Open from /Applications (first launch may ask to Open)"
echo
echo "Note: this DMG is arm64 (Apple Silicon) only. Intel Macs need a separate build."
