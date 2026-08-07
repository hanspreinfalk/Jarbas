---
name: composio
description: >-
  Use Composio Tool Router MCP for the signed-in user's connected apps (Gmail,
  Slack, GitHub, Notion, Calendar, and 1000+ more). Use when the user asks to
  email, message, create issues, read docs, or otherwise act in an external app.
---

# Composio

External apps go through **Composio Tool Router MCP** attached to this Ask
session (project API key + this user's id). Do **not** use the Composio CLI via
bash for app actions.

Never run: `composio search`, `composio execute`, `composio whoami`,
`composio tools`, `composio list-tools`, `composio connections`, `composio login`,
or any personal `~/.composio` binary. Those thrash and do not auth this app.

## Credentials (already injected)

- `COMPOSIO_API_KEY` — used by the MCP server header
- `COMPOSIO_USER_ID` / `COMPOSIO_TEST_USER_ID` — session user (Convex / Clerk)
- MCP server name: `composio`

If Composio MCP tools are missing, say app tools are unavailable and stop. Do
not debug with bash.

## Workflow (strict)

1. Call **COMPOSIO_SEARCH_TOOLS** once with the use case
   (example: `read recent Gmail emails`).
2. If a toolkit is not connected, tell the user to open **Tools → Connectors**
   in Jarbas (or use COMPOSIO_MANAGE_CONNECTIONS once if that tool is available).
   Do not open browsers yourself.
3. Load schemas with **COMPOSIO_GET_TOOL_SCHEMAS** only when needed.
4. Run with **COMPOSIO_MULTI_EXECUTE_TOOL** (strict schema args).
5. Summarize results for the user.

Stop after one failed Composio MCP call unless a single schema or connection
fix is clearly indicated. Never run exploratory loops of 5+ tools.

## Rules

- Prefer MCP meta tools only. No bash Composio. No filesystem probing of
  `~/.jarbas/composio*`.
- Never invent tool slugs or arguments.
- Confirm recipients / destinations for outbound actions when unclear.
- Stay inside the injected user identity.
- Keep answers short; do not dump huge JSON.
