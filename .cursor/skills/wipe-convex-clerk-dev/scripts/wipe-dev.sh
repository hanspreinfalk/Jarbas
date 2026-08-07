#!/usr/bin/env bash
# Wipe Convex + Clerk DEVELOPMENT data for this Jarbas project.
# Refuses to run against non-dev Convex deployments or non-test Clerk keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${CONVEX_DEPLOYMENT:?CONVEX_DEPLOYMENT missing (load .env.local)}"
: "${CLERK_SECRET_KEY:?CLERK_SECRET_KEY missing (load .env.local)}"

case "$CONVEX_DEPLOYMENT" in
  dev:*) ;;
  *)
    echo "REFUSING: CONVEX_DEPLOYMENT is not a personal dev deployment: $CONVEX_DEPLOYMENT" >&2
    exit 1
    ;;
esac

case "$CLERK_SECRET_KEY" in
  sk_test_*) ;;
  *)
    echo "REFUSING: CLERK_SECRET_KEY is not a Clerk test/dev key (expected sk_test_…)" >&2
    exit 1
    ;;
esac

echo "== Convex wipe: $CONVEX_DEPLOYMENT =="
TABLES="$(npx convex data 2>/dev/null || true)"
if [[ -z "${TABLES//[[:space:]]/}" ]]; then
  echo "No Convex tables found (already empty or no schema pushed)."
else
  while IFS= read -r tableName; do
    [[ -z "$tableName" ]] && continue
    echo "Clearing Convex table: $tableName"
    npx convex import --table "$tableName" --replace -y --format jsonLines /dev/null
  done <<< "$TABLES"
fi

echo
echo "== Clerk wipe (test instance) =="
API="https://api.clerk.com/v1"
AUTH_HEADER="Authorization: Bearer $CLERK_SECRET_KEY"

# Organizations first, then users. Avoid shell var UID (readonly in zsh).
while true; do
  ORGS_JSON="$(curl -sS -H "$AUTH_HEADER" "$API/organizations?limit=100")"
  ORG_IDS="$(python3 -c 'import json,sys; d=json.load(sys.stdin); data=d.get("data",d) if isinstance(d,dict) else d; [print(o["id"]) for o in data]' <<<"$ORGS_JSON")"
  if [[ -z "${ORG_IDS}" ]]; then
    echo "Organizations remaining: 0"
    break
  fi
  ORG_COUNT="$(printf '%s\n' "$ORG_IDS" | grep -c . || true)"
  echo "Organizations remaining: $ORG_COUNT"
  while IFS= read -r ORG_ID; do
    [[ -z "$ORG_ID" ]] && continue
    echo "Deleting organization $ORG_ID"
    curl -sS -X DELETE -H "$AUTH_HEADER" "$API/organizations/$ORG_ID" >/dev/null
  done <<< "$ORG_IDS"
done

while true; do
  USERS_JSON="$(curl -sS -H "$AUTH_HEADER" "$API/users?limit=100")"
  USER_IDS="$(python3 -c 'import json,sys; d=json.load(sys.stdin); data=d if isinstance(d,list) else d.get("data",[]); [print(u["id"]) for u in data]' <<<"$USERS_JSON")"
  if [[ -z "${USER_IDS}" ]]; then
    echo "Users remaining: 0"
    break
  fi
  USER_COUNT="$(printf '%s\n' "$USER_IDS" | grep -c . || true)"
  echo "Users remaining: $USER_COUNT"
  while IFS= read -r CLERK_USER_ID; do
    [[ -z "$CLERK_USER_ID" ]] && continue
    echo "Deleting user $CLERK_USER_ID"
    curl -sS -X DELETE -H "$AUTH_HEADER" "$API/users/$CLERK_USER_ID" >/dev/null
  done <<< "$USER_IDS"
done

echo
echo "== Verify =="
echo "Convex tables:"
npx convex data || true

ORG_COUNT="$(curl -sS -H "$AUTH_HEADER" "$API/organizations?limit=100" | python3 -c 'import json,sys; d=json.load(sys.stdin); data=d.get("data",d) if isinstance(d,dict) else d; print(len(data))')"
USER_COUNT="$(curl -sS -H "$AUTH_HEADER" "$API/users?limit=100" | python3 -c 'import json,sys; d=json.load(sys.stdin); data=d if isinstance(d,list) else d.get("data",[]); print(len(data))')"
echo "Clerk organizations: $ORG_COUNT"
echo "Clerk users: $USER_COUNT"
echo "Done."
