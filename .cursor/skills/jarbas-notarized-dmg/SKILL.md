---
name: jarbas-notarized-dmg
description: >-
  Builds a signed and notarized Apple Silicon Jarbas macOS DMG via
  scripts/tauri-build-dmg.sh. Use when the user asks for a notarized DMG,
  signed macOS build, notarytool/stapler packaging, or a .dmg for other Macs
  in Documents/tauri/jarbas.
---

# Jarbas notarized DMG

Produces a **Developer ID signed + Apple notarized** arm64 DMG that other Macs
can open without Gatekeeper blocks.

## Prerequisites

Repo root: `Documents/tauri/jarbas`

`.env.local` must include (see `.env.example`):

- `APPLE_SIGNING_IDENTITY` or `CSC_NAME`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD` (or `APPLE_PASSWORD`)
- `APPLE_TEAM_ID`

Also required: `src-tauri/entitlements.plist`, Xcode CLT (`codesign`, `notarytool`, `stapler`, `hdiutil`).

## Execute

From the repo root, run in the background (build + notarize often takes several minutes):

```bash
bash scripts/tauri-build-dmg.sh
```

Do **not** run `npx tauri build --bundles dmg` alone for distribution. The script:

1. Fetches bundled Node / ffmpeg / screenpipe
2. Builds the `.app` **without** Tauri mid-build notarization (nested Mach-O stay unsigned otherwise)
3. Deep-signs every Mach-O under the `.app` with the Developer ID + entitlements
4. Notarizes + staples the `.app`
5. Creates, signs, notarizes, and staples the DMG

## Output

```
src-tauri/target/release/bundle/dmg/Jarbas_0.1.0_aarch64.dmg
```

Confirm success with:

```bash
ls -lh src-tauri/target/release/bundle/dmg/*.dmg
xcrun stapler validate src-tauri/target/release/bundle/dmg/Jarbas_0.1.0_aarch64.dmg
spctl -a -vv -t install src-tauri/target/release/bundle/dmg/Jarbas_0.1.0_aarch64.dmg
```

## Gotchas

- **arm64 only.** Intel Macs need a separate build.
- Frontend `tsc` must pass; a type error aborts `beforeBuildCommand`.
- If notarization env is left set during Tauri’s own bundle step, nested Node binaries can fail Apple review — the script unsets those vars for `tauri build`.
- Missing Apple env vars: script exits early with the missing key names.

## Optional follow-ups

Only if the user asks: upload the DMG (Drive, GitHub Release, etc.). Do not upload by default.
