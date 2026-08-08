---
name: jarbas-windows-build
description: >-
  Builds Jarbas Windows x64 installer (.exe) and portable zip via GitHub Actions
  workflow windows-build.yml, then downloads artifacts. Use when the user asks
  for a Windows exe, NSIS installer, portable zip, Windows build, or
  jarbas-windows-x64 artifacts in Documents/tauri/jarbas.
---

# Jarbas Windows exe + zip

Windows builds run on **GitHub Actions** (not locally on macOS). Workflow:
`.github/workflows/windows-build.yml`.

## Trigger

From the repo root, prefer the latest commit on `main` (or the branch the user
names):

```bash
gh workflow run windows-build.yml --ref main
gh run list --workflow=windows-build.yml --limit 3
```

Pushing to `main` or `windows-*` also triggers the workflow. Prefer
`workflow_dispatch` when you need a build without an extra push.

Watch until green:

```bash
gh run watch <run-id> --exit-status
```

Required Actions secrets: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CONVEX_URL`,
`COMPOSIO_API_KEY`.

## Download artifacts

```bash
mkdir -p /tmp/jarbas-release
gh run download <run-id> -n jarbas-windows-x64 -D /tmp/jarbas-release/windows
find /tmp/jarbas-release/windows -type f -exec ls -lh {} \;
```

Artifact layout:

| Path under download dir | Role |
|---|---|
| `bundle/nsis/Jarbas_0.1.0_x64-setup.exe` | NSIS installer (ship as Windows **exe**) |
| `jarbas.exe` | Portable binary |
| `bundle/msi/*.msi` | MSI (optional; include only if asked) |

## Make the portable zip

```bash
cd /tmp/jarbas-release
cp windows/bundle/nsis/Jarbas_0.1.0_x64-setup.exe ./Jarbas_0.1.0_x64-setup.exe
zip -j Jarbas_0.1.0_windows-x64.zip windows/jarbas.exe
ls -lh Jarbas_0.1.0_x64-setup.exe Jarbas_0.1.0_windows-x64.zip
```

Default deliverables unless the user asks otherwise:

1. `Jarbas_0.1.0_x64-setup.exe`
2. `Jarbas_0.1.0_windows-x64.zip` (contains `jarbas.exe`)

## Gotchas

- Run `gh` from the git repo so auth/repo context resolve.
- If `tsc` fails on `main`, the Windows job fails the same way — fix frontend first.
- Earlier queued runs on the same push may fail while a later run succeeds; use the green run for the commit you want.
- Do not try to cross-compile the Windows NSIS installer on macOS for release.

## Optional follow-ups

Only if the user asks: upload exe/zip (Drive, GitHub Release, etc.). Do not upload by default.
