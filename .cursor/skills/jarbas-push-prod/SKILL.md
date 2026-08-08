---
name: jarbas-push-prod
description: >-
  Ships the current Jarbas backend/work by running `npx convex dev`, committing
  and pushing Cursor skills under `.cursor/skills/`, pushing `main` to GitHub,
  and checking Linear (Jarbas team) for status updates. Use ONLY when the user
  says "jarbas push to prod", "push to prod", or "ship to prod". Do NOT run
  this full workflow just because they mentioned `npx convex dev` alone.
---

# Jarbas push to prod (Convex dev + Cursor skills + GitHub main + Linear)

Despite the name, this skill does **not** run `npx convex deploy` to Convex
production. Today the app still uses Convex **dev**. Saying **“jarbas push to
prod”** means:

1. Push Convex functions with **`npx convex dev`**
2. Commit + push **Cursor skills** under `.cursor/skills/` (if dirty)
3. Push **`main`** to GitHub
4. Check Linear for anything that should be updated

Desktop installer refresh is **out of scope** unless the user also asks — use
[jarbas-build-releases](../jarbas-build-releases/SKILL.md).

## Trigger rules

| User says | Do this skill? |
|---|---|
| “jarbas push to prod” / “push to prod” / “ship to prod” | **Yes** — full workflow below |
| Only “npx convex dev” / “convex:dev” / “sync convex” | **No** — just run that command if asked; skip skills + GitHub + Linear unless they also ask |

## Canonical targets

| Item | Value |
|---|---|
| Convex team | `hans-preinfalk` |
| Convex project | `jarbas` |
| Convex deployment | **dev** `artful-marten-116` (`https://artful-marten-116.convex.cloud`) |
| Cursor skills | `.cursor/skills/**` on **`main`** (repo-local agent skills) |
| GitHub | `hanspreinfalk/Jarbas` — branch **`main`** |
| Linear team | Jarbas (`JAR`) — id `d9d01d53-e315-4810-b0ad-5f0e6139b35e` |

## Workflow

```
- [ ] 1. Preflight (repo on main, note dirty skills vs other files)
- [ ] 2. `npx convex dev --once` → artful-marten-116
- [ ] 3. Commit + include Cursor skills (`.cursor/skills/`)
- [ ] 4. Push `main` to GitHub (`origin`)
- [ ] 5. Linear hygiene (Launch / deploy-related issues)
- [ ] 6. Report results
```

### 1. Preflight

From repo root `Documents/tauri/jarbas`:

```bash
git status
git branch --show-current
git log -1 --oneline
npx convex deployments   # expect jarbas → artful-marten-116 (dev)
```

- Prefer working on **`main`**. If on another branch, ask before merging/pushing to main.
- **Cursor skills are in scope:** any dirty/untracked files under `.cursor/skills/`
  must be committed and pushed as part of this workflow (see step 3). That is
  part of “push to prod,” not optional.
- For **other** uncommitted files (app code, docs, etc.), ask before committing —
  do not invent commits outside `.cursor/skills/` unless the user already asked.
- Refuse wipe / delete-data requests here — that is
  [wipe-convex-clerk-dev](../wipe-convex-clerk-dev/SKILL.md) (dev only).

### 2. Convex dev

One-shot (agent runs):

```bash
npx convex dev --once
```

Long-running watch is **not** required for this skill (that’s for local
`tauri` / `npm run convex:dev` sessions).

Expect: functions ready on `artful-marten-116`.

Do **not** run `npx convex deploy` / `npm run convex:deploy` as part of this
skill unless the user later explicitly asks to cut over to Convex production
(`standing-puffin-912`).

### 3. Commit Cursor skills

Skills live in the repo so “prod” agents and teammates get the same workflows.
On every push-to-prod run:

```bash
git status -- .cursor/skills
git add .cursor/skills/
```

If there is anything staged under `.cursor/skills/`:

1. Draft a short commit message focused on why (skill add/update).
2. Commit **only** those paths (do not sneak in unrelated files).
3. Follow the repo git commit protocol (HEREDOC message; no `--no-verify`;
   never commit secrets).

Example:

```bash
git commit -m "$(cat <<'EOF'
Update Cursor push-to-prod skill to ship skills with main.

EOF
)"
```

If `.cursor/skills/` is clean, say so and continue. Do **not** create an empty
commit.

Still never commit `.env.local`, deploy keys, or Clerk/Composio secrets.

### 4. Push `main` to GitHub

```bash
git status
git push -u origin main
```

- Only push **`main`** to `origin` (`https://github.com/hanspreinfalk/Jarbas`).
- If there is nothing to push (already up to date), say so and continue.
- Do **not** force-push. Do **not** push other branches unless the user asks.
- After a skills commit in step 3, this push **must** include that commit.

### 5. Linear hygiene (required)

Check the **Jarbas** team via Composio Linear tools (preferred) or `LINEAR_*`
MCP:

| Field | Value |
|---|---|
| Team name | Jarbas |
| Team id | `d9d01d53-e315-4810-b0ad-5f0e6139b35e` |
| Team key | `JAR` |

1. `LINEAR_LIST_ISSUES_BY_TEAM_ID` with `team_id` above (`first` ≤ 100; paginate).
2. Focus on open issues this ship may close or unblock:
   - Label **Launch** (especially **JAR-19** production variables, **JAR-20** live
     Clerk billing, **JAR-21** download landing page)
   - Titles around deploy / prod / env / release / Convex / GitHub
3. Summarize for the user: Done candidates vs still-blocked.
4. **Only after explicit user confirmation**, move issues with
   `LINEAR_UPDATE_ISSUE` (`issueId` + `stateId`). Done:
   `1e670402-29df-43d4-9a38-98cea7c742d3`. Todo:
   `ed3e3989-69ee-4d1e-ad5a-e7c521969d26`. In Progress:
   `aa4b120c-adbb-421f-8683-50b632e282e8`.
5. Optional: `LINEAR_CREATE_LINEAR_COMMENT` noting ship time + Convex dev
   (`artful-marten-116`) + git SHA on `main` — no secrets.

Do **not** bulk-close Launch issues just because Convex dev + GitHub were
updated. JAR-19 stays open until real Convex **production** env vars are
verified.

### 6. Report

End reply with:

1. Convex dev result (`artful-marten-116`, ok / failed)
2. Cursor skills: committed paths (or clean) + whether they landed on `main`
3. GitHub: whether `main` was pushed (or already up to date) + SHA
4. Linear: issues updated (if any) + remaining Launch/Todo blockers

## Packaged desktop caveat

`VITE_CONVEX_URL` / `VITE_CLERK_PUBLISHABLE_KEY` are **build-time**. This skill
does **not** rebuild DMG/exe. For Drive downloads use
[jarbas-build-releases](../jarbas-build-releases/SKILL.md).

## Hard rules

- Trigger only on “push to prod” phrasing — **not** on bare `npx convex dev`.
- Internally use **`npx convex dev`**, not `npx convex deploy`.
- Always ship dirty **`.cursor/skills/`** with the push (commit + push to `main`).
- Push **`main`** only; no force-push.
- Never wipe prod or.dev data from this skill.
- Never commit `.env.local`, deploy keys, or Clerk/Composio secrets.
- Never mark Linear Done without user confirmation.
- Always `hans-preinfalk` / `jarbas` for Convex; `hanspreinfalk/Jarbas` for GitHub.
