---
name: jarbas-build-releases
description: >-
  Builds Jarbas macOS + Windows release installers and replaces the shared
  Google Drive "Jarbas Downloads" folder (macOS DMG, Windows exe + zip). Use
  when the user says "build the releases", "ship releases", "refresh Drive
  builds", "update the downloads folder", or wants new Mac and Windows
  binaries uploaded to the friends share link.
---

# Jarbas build releases → Drive

End-to-end release: notarized **macOS DMG** + **Windows NSIS exe** + portable
**zip**, then **replace in-place** in the shared Drive downloads folder.

## Canonical Drive target (do not invent new folders)

| Item | Value |
|---|---|
| Folder name | `Jarbas Downloads` |
| Share link | https://drive.google.com/drive/folders/1IwGfAHfMLBYpqbCZLGb4p_eRoD5TyUvs |
| Root folder ID | `1IwGfAHfMLBYpqbCZLGb4p_eRoD5TyUvs` |
| macOS subfolder ID | `14qn8mt1hVzWkU8CYz0S5TCFuPleSJp4y` |
| Windows subfolder ID | `1SNlIhwXqbq9st0G4jtEiX9dvVIqIr1np` |
| Drive account | Composio alias **`work`** (`hans@thedeploy.co`) |

Layout to preserve:

```
Jarbas Downloads/
  macOS/
    Jarbas_0.1.0_aarch64.dmg
  Windows/
    Jarbas_0.1.0_x64-setup.exe
    Jarbas_0.1.0_windows-x64.zip
```

Stable file IDs (prefer these for replace). If a move/rename broke them,
`GOOGLEDRIVE_FIND_FILE` inside the subfolder and update below:

| File | File ID |
|---|---|
| `Jarbas_0.1.0_aarch64.dmg` | `1gpixiQJIhmc4sE7YKCVzgY3dLesi01h-` |
| `Jarbas_0.1.0_x64-setup.exe` | `1mkJbTGRGzMvpj6SznBDslsI-Ju5YpLkc` |
| `Jarbas_0.1.0_windows-x64.zip` | `1BT12oWsjC5jk1yWPQHlr8G7eUPV9oXbv` |

## Prerequisites

- Repo: `Documents/tauri/jarbas`, preferably clean `main` with desired commit pushed (Windows CI needs it).
- Read and follow sibling skills for build mechanics:
  - [jarbas-notarized-dmg](../jarbas-notarized-dmg/SKILL.md)
  - [jarbas-windows-build](../jarbas-windows-build/SKILL.md)
- Composio Google Drive **work** connection active.
- Backend-only production push (Convex + Linear check) is
  [jarbas-push-prod](../jarbas-push-prod/SKILL.md) — run that first if prod
  functions/env must be live before friends install new binaries.

## Workflow

Track progress:

```
- [ ] 1. Start notarized DMG build (background)
- [ ] 2. Start / watch Windows CI on the target commit
- [ ] 3. Stage all three artifacts under /tmp/jarbas-release
- [ ] 4. Replace Drive files in-place (same names + IDs)
- [ ] 5. Verify sizes/modifiedTime + return share link
```

### 1. macOS DMG

```bash
bash scripts/tauri-build-dmg.sh
```

Validate, then stage:

```bash
mkdir -p /tmp/jarbas-release
cp -f src-tauri/target/release/bundle/dmg/Jarbas_0.1.0_aarch64.dmg /tmp/jarbas-release/
xcrun stapler validate /tmp/jarbas-release/Jarbas_0.1.0_aarch64.dmg
```

### 2. Windows exe + zip

Prefer an existing green `windows-build.yml` run for the commit; otherwise:

```bash
gh workflow run windows-build.yml --ref main
gh run watch <run-id> --exit-status
```

Download + package:

```bash
rm -rf /tmp/jarbas-release/windows
gh run download <run-id> -n jarbas-windows-x64 -D /tmp/jarbas-release/windows
cp -f /tmp/jarbas-release/windows/bundle/nsis/Jarbas_0.1.0_x64-setup.exe /tmp/jarbas-release/
rm -f /tmp/jarbas-release/Jarbas_0.1.0_windows-x64.zip
zip -j /tmp/jarbas-release/Jarbas_0.1.0_windows-x64.zip /tmp/jarbas-release/windows/jarbas.exe
```

### 3. Upload / replace on Drive (Composio)

Binaries are ~80MB → use **resumable** update, not `GOOGLEDRIVE_UPLOAD_FILE` (5MB cap).

**Staging pattern that works** (local paths are not valid `s3key` values):

1. Publish a short-lived GitHub release (or reuse one) with the three files so the Composio workbench can HTTP-download them. Tag example: `v0.1.0-YYYYMMDD` or `v0.1.0-YYYYMMDD-N`.
2. In `COMPOSIO_REMOTE_WORKBENCH`, download each file to `/home/user/...`, then `upload_local_file(path)` → capture `s3key`.
3. `GOOGLEDRIVE_RESUMABLE_UPLOAD` with:
   - `account`: `work`
   - `file_id`: stable ID from the table above
   - `file_to_upload`: `{ name, mimetype, s3key }`
   - `folder_to_upload_to`: the matching subfolder ID (macOS or Windows)

MIME types:

| File | mimetype |
|---|---|
| `.dmg` | `application/x-apple-diskimage` |
| `.exe` | `application/x-msdownload` |
| `.zip` | `application/zip` |

**Hard rules**

- Replace **existing** file IDs (keep share URLs stable). Do **not** create duplicates at root.
- Keep the **macOS** / **Windows** subfolder layout.
- Do **not** change the public anyone-with-link reader permission unless asked.
- One large file per workbench cell (3-minute limit). Prefer `/home/user` over `/mnt/files` for ~80MB downloads.

### 4. Verify + report

Confirm each file’s `size` + `modifiedTime` via `GOOGLEDRIVE_GET_FILE_METADATA` / list children of both subfolders.

End reply with:

1. The share link: https://drive.google.com/drive/folders/1IwGfAHfMLBYpqbCZLGb4p_eRoD5TyUvs
2. What changed (DMG / exe / zip) and approximate sizes
3. Commit SHA / CI run used for Windows

## Gotchas

- If `file_id` 404s after a prior reorganize, rediscover by name inside the subfolder and continue with replace (then update this skill’s ID table).
- Version in filenames is still `0.1.0` until `tauri.conf.json` / package version changes — keep names identical so replace-by-name stays obvious.
- Do not upload MSI unless asked.
- Building only Mac or only Windows is a partial run of the sibling skills; this skill always does **both** + Drive update unless the user explicitly scopes it.
