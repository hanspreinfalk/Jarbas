---
name: wipe-convex-clerk-dev
description: >-
  Wipes Jarbas development Convex data and Clerk development users/organizations.
  Use when the user asks to reset/wipe/clear Convex, wipe Clerk users or orgs,
  clear local/dev cloud state, or run a fresh onboarding/auth reset — development
  only (never production).
---

# Wipe Convex + Clerk (development only)

Irreversibly clears **development** backend state for this Jarbas repo:

1. **Convex** personal `dev:` deployment — empty every application table (schema/functions stay).
2. **Clerk** test instance (`sk_test_…`) — delete every organization, then every user.

## When to use

User asks to wipe/reset/clear Convex and/or Clerk **dev** data, start from a clean slate, or delete all Clerk users/orgs in development.

## Hard safety rules

- **Dev only.** Refuse unless:
  - `CONVEX_DEPLOYMENT` starts with `dev:`
  - `CLERK_SECRET_KEY` starts with `sk_test_`
- Never run against `prod`, `sk_live_`, or a deploy key that is not clearly personal/dev.
- Do not soft-confirm if the user already explicitly asked to wipe; still enforce the checks above.
- Load secrets from repo-root `.env.local` (never commit them).

## Execute

From the Jarbas repo root (`Documents/tauri/jarbas`):

```bash
bash .cursor/skills/wipe-convex-clerk-dev/scripts/wipe-dev.sh
```

Or perform the same steps manually:

### 1. Convex — clear all tables

```bash
set -a && source .env.local && set +a
# must be like: dev:artful-marten-116
for tableName in $(npx convex data); do
  npx convex import --table "$tableName" --replace -y --format jsonLines /dev/null
done
```

### 2. Clerk — delete orgs, then users

Use Backend API with `CLERK_SECRET_KEY`. Prefer `curl` (Python `urllib` may fail SSL on some macOS Python installs). **Do not name a shell variable `UID`** (readonly in zsh).

```bash
API=https://api.clerk.com/v1
# DELETE /organizations/{org_id} for each org from GET /organizations?limit=100
# then DELETE /users/{user_id} for each user from GET /users?limit=100
# paginate / loop until counts are 0
```

### 3. Verify

- `npx convex data <table>` → no documents for each table
- `GET /organizations` and `GET /users` → empty

## Notes

- Convex has no single “reset DB” command; empty snapshot import (`--replace` with `/dev/null`) is the supported wipe.
- Tables `user` and `reports` are the current app tables; the script clears **all** tables returned by `npx convex data`.
- After wipe, the app needs fresh Clerk sign-up / org creation; Convex user rows will recreate on sync.
