---
name: jarbas-push-prod
description: >-
  Deploys Jarbas Convex functions to the production deployment, verifies prod
  environment variables, and checks Linear (Jarbas team) for Launch issues that
  need status updates. Use when the user says "push to prod", "deploy to
  production", "convex deploy prod", "ship backend to prod", or wants a
  production Convex push with a Linear hygiene check.
---

# Jarbas push to prod (Convex + Linear)

Ship **Convex backend** to the project’s default **production** deployment, confirm
prod env vars, then review Linear for related Launch work. Desktop installer
refresh is **out of scope** unless the user also asks — use
[jarbas-build-releases](../jarbas-build-releases/SKILL.md).

## Canonical deployments

| Item | Value |
|---|---|
| Convex team | `hans-preinfalk` |
| Convex project | `jarbas` |
| Dev deployment | `artful-marten-116` (`dev:…` in `.env.local`) |
| Prod deployment | `standing-puffin-912` (default target of `npx convex deploy`) |

`npx convex deploy` pushes to **prod** even when `.env.local` points at dev. Do
**not** confuse this with `npx convex dev` (dev only).

## Required prod env vars

Prod must have at least what auth + Composio need (same names as dev):

| Name | Purpose |
|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk Frontend API URL / JWT issuer used by `convex/auth.config.ts` |
| `COMPOSIO_API_KEY` | Server-side Composio key (packaged app fetches via Convex after sign-in) |

Check:

```bash
npx convex env list --prod --names-only
```

If empty or incomplete, set from known-good **production** values (never commit
secrets; prefer live Clerk issuer for real prod, not `*.clerk.accounts.dev`
unless intentionally shipping test auth):

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN 'https://YOUR_CLERK_ISSUER'
npx convex env set --prod COMPOSIO_API_KEY 'ak_…'
npx convex env list --prod --names-only
```

Copy values from the Convex dashboard or from a secure vault — do **not** dump
secret values into chat or git.

## Workflow

Track progress:

```
- [ ] 1. Preflight (repo + confirm prod intent)
- [ ] 2. Verify / set prod Convex env vars
- [ ] 3. Dry-run then deploy Convex to prod
- [ ] 4. Linear hygiene (Jarbas team)
- [ ] 5. Report what shipped + what Linear still needs
```

### 1. Preflight

From repo root `Documents/tauri/jarbas`:

```bash
git status
git log -1 --oneline
npx convex deployments   # expect configured project jarbas; note prod name
```

- Prefer a clean `main` with the commit you intend already pushed.
- Confirm the user wants **production** (not preview / not wipe-dev).
- Refuse if they asked to wipe data — that is
  [wipe-convex-clerk-dev](../wipe-convex-clerk-dev/SKILL.md) and is **dev only**.

### 2. Prod env vars

Run `npx convex env list --prod --names-only`. If `CLERK_JWT_ISSUER_DOMAIN` or
`COMPOSIO_API_KEY` is missing, stop and set them (see table above) before
deploying functions that depend on auth/Composio.

Related Linear issue to keep in mind: **JAR-19** — “Update to production
variables” (Launch / Billing & Launch). Do not mark it Done until prod env is
actually correct for the intended Clerk mode (test vs live).

### 3. Deploy Convex

Preview:

```bash
npx convex deploy --dry-run
```

Ship:

```bash
npm run convex:deploy
# same as: npx convex deploy
```

If the CLI asks for confirmation that you are pushing to production, confirm
only after the dry-run looked right. Attach an audit message when useful:

```bash
npx convex deploy --message "prod: <short why>"
```

Verify afterward (optional):

```bash
npx convex function-spec --deployment prod | head
```

### 4. Linear hygiene (required)

After (or while) deploying, check the **Jarbas** team via Composio Linear tools
(preferred) or `LINEAR_*` MCP:

| Field | Value |
|---|---|
| Team name | Jarbas |
| Team id | `d9d01d53-e315-4810-b0ad-5f0e6139b35e` |
| Team key | `JAR` |

1. `LINEAR_LIST_ISSUES_BY_TEAM_ID` with `team_id` above (`first` ≤ 100; paginate).
2. Focus on open issues that a prod push may close or unblock:
   - Label **Launch** (especially **JAR-19** production variables, **JAR-20** live
     Clerk billing, **JAR-21** download landing page)
   - Anything titled around deploy / prod / env / release
3. Summarize for the user: Done candidates vs still-blocked.
4. **Only after explicit user confirmation**, move issues with
   `LINEAR_UPDATE_ISSUE` (`issueId` + `stateId`). Done state id for this team:
   `1e670402-29df-43d4-9a38-98cea7c742d3` (name `Done`). Todo:
   `ed3e3989-69ee-4d1e-ad5a-e7c521969d26`. In Progress:
   `aa4b120c-adbb-421f-8683-50b632e282e8`.
5. Optional: `LINEAR_CREATE_LINEAR_COMMENT` noting deploy time + Convex prod
   deployment name (`standing-puffin-912`) — no secrets in comments.

Do **not** bulk-close Launch issues just because Convex functions were pushed.
JAR-19 stays open until production variables are verified. Desktop distribution
still needs [jarbas-build-releases](../jarbas-build-releases/SKILL.md) when
binaries must hit Drive.

### 5. Report

End reply with:

1. Prod deployment name + whether env var names were present
2. Deploy result (ok / failed) and git SHA used
3. Linear: issues updated (if any) + remaining Launch/Todo blockers worth knowing

## Packaged desktop caveat

`VITE_CONVEX_URL` / `VITE_CLERK_PUBLISHABLE_KEY` are **build-time** (see
`src/components/ConvexClientProvider.tsx`). Pushing Convex to prod does **not**
retarget already-shipped DMG/exe builds. To point friends’ downloads at prod:

1. Build with prod Vite env (prod Convex URL + intended Clerk publishable key)
2. Then run [jarbas-build-releases](../jarbas-build-releases/SKILL.md)

Keep that distinction explicit in the report.

## Hard rules

- Never wipe prod data. Never run wipe-dev scripts against `standing-puffin-912`.
- Never commit `.env.local`, deploy keys, or Clerk/Composio secrets.
- Never mark Linear Done without user confirmation.
- Do not invent a new Convex project; always `hans-preinfalk` / `jarbas`.
- `convex deploy` → prod; `convex dev` → personal dev. Do not swap them.
