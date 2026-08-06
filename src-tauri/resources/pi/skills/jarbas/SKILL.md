---
name: jarbas
description: >-
  Local Jarbas desktop app agent. Use when answering Ask questions about the
  user's local Jarbas data under ~/.jarbas, running bash/read in that tree, or
  diagnosing the Pi runtime install.
---

# Jarbas

This is the Tauri Jarbas desktop app. Local state lives at `~/.jarbas`.

## Paths

| Path | Purpose |
|---|---|
| `~/.jarbas` | App data root |
| `~/.jarbas/pi-agent` | Bundled Pi coding agent install |
| `~/.jarbas/pi-config` | Pi settings, skills, APPEND_SYSTEM |
| `~/.jarbas/pi-sessions` | Pi session files |
| `~/.jarbas/npm-cache` | npm cache used by the installer |

## Rules

- Do not use tools for greetings or small talk.
- Prefer `bash` / `read` under `~/.jarbas` only when you need local facts.
- Do not assume `~/.jarbas-main` exists or is related to this app.
- Do not invent paths, IDs, or data that tools did not return.
- Keep replies concise; extract the answer instead of dumping raw command output.
- Avoid exploratory command loops. Stop after a failed attempt and report it.
