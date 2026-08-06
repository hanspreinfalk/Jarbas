---
name: jarbas
description: >-
  Local Jarbas desktop app agent. Use when answering Ask questions about the
  user's local Jarbas data under ~/.jarbas, running bash/read in that tree, or
  diagnosing the Pi runtime install.
---

# Jarbas

This is the Tauri Jarbas desktop app. Local state lives at `~/.jarbas`.

Capture today is **screen + accessibility**. There is **no audio access** yet.
For spoken/meeting context the user needs a separate source such as Granola.

## Paths

| Path | Purpose |
|---|---|
| `~/.jarbas` | App data root |
| `~/.jarbas/db.sqlite` | Paired screen + accessibility capture DB |
| `~/.jarbas/data/` | Capture JPEG snapshots |
| `~/.jarbas/*.mp4` | Screen recording sessions (no audio track) |
| `~/.jarbas/pi-agent` | Bundled Pi coding agent install |
| `~/.jarbas/pi-config` | Pi settings, skills, APPEND_SYSTEM |
| `~/.jarbas/pi-sessions` | Pi session files |
| `~/.jarbas/npm-cache` | npm cache used by the installer |

## Dates

Capture timestamps are often stored in UTC. Always convert to the user's current
local timezone (from the prompt context line) before displaying. Never show raw
ISO-8601 or a trailing `UTC`.

## Audio framing

Do not say "no captured audio" as if recording failed. Say we do not have access
to audio yet, and that connecting Granola (or similar) is how to get transcripts
/ spoken context.

Never mention Screenpipe or other internal capture vendor/SDK names to the user.

## Rules

- Do not use tools for greetings or small talk.
- Prefer `bash` / `read` under `~/.jarbas` only when you need local facts.
- Do not assume `~/.jarbas-main` exists or is related to this app.
- Do not invent paths, IDs, or data that tools did not return.
- Keep replies concise; extract the answer instead of dumping raw command output.
- Avoid exploratory command loops. Stop after a failed attempt and report it.
