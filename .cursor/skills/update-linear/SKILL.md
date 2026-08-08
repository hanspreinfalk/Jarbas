---
name: update-linear
description: >-
  Creates or updates Linear projects, documents, issues, and project updates
  for the Jarbas team only. Use when the user asks to update Linear, add
  something to Linear, create a Linear project/doc/issue, sync research or
  decisions into Linear, or says "update linear".
---

# Update Linear (Jarbas only)

Push research, decisions, commercial notes, and follow-ups into Linear — **Jarbas team only**.

## Hard scope (non-negotiable)

| Allowed | Forbidden |
|---|---|
| Team **Jarbas** | Team **Deploy Co Product** |
| | Team **Reefo** |
| | Any other Linear team |

**Jarbas team ID (use this UUID everywhere):** `d9d01d53-e315-4810-b0ad-5f0e6139b35e`

Before every create/update:

1. Resolve `team_id` / `team_ids` to the Jarbas UUID above.
2. If an existing project/issue is on another team, **move it to Jarbas** or recreate on Jarbas — do not leave new work on Deploy Co Product or Reefo.
3. Never create projects with `team_ids` that include non-Jarbas teams.

If the user asks to put something on Deploy Co Product or Reefo, refuse and keep it on Jarbas (explain briefly).

## When to use which Linear surface

| Content type | Put it in | Notes |
|---|---|---|
| Long research / architecture / strategy | **Project Document** | Best for markdown that must be revisited |
| Status snapshot / announcement | **Project update** | Short; link the document |
| Actionable follow-ups | **Issues** in the project | Clear done-when criteria |
| New topic area | **Project** on Jarbas | One project per coherent workstream |
| One-line blurb | Project description | Max ~255 chars — not for full analysis |

Do **not** dump long analyses into issue titles or project descriptions.

## Workflow

1. **Classify the content** — new project vs existing project; document vs issues vs update.
2. **Find or create the Jarbas project**
   - List projects; match by name on Jarbas.
   - If missing, create with `team_ids: ["d9d01d53-e315-4810-b0ad-5f0e6139b35e"]`.
3. **Write the Document** (for substantial content)
   - Use Linear GraphQL `documentCreate` with `projectId` + markdown `content`.
   - Include canonical external links when the user provided them.
   - Label facts vs conclusions when the source was research.
4. **Post a project update** summarizing + linking the document.
5. **Create issues** only for concrete follow-ups (roadmap items, decisions to implement).
6. **Return Linear URLs** (project, document, issues) to the user.

## Tooling

Prefer Composio Linear tools (or `composio execute`):

- `LINEAR_LIST_LINEAR_TEAMS` / projects — confirm Jarbas
- `LINEAR_CREATE_LINEAR_PROJECT` — always pass Jarbas `team_ids`
- `LINEAR_CREATE_LINEAR_ISSUE` — `team_id` = Jarbas UUID + `project_id`
- `LINEAR_CREATE_PROJECT_UPDATE` — status posts
- `LINEAR_RUN_QUERY_OR_MUTATION` — `documentCreate` / `projectUpdate` (e.g. move teams)

For long markdown bodies, write content to a temp JSON file and run:

```bash
composio execute LINEAR_RUN_QUERY_OR_MUTATION -d @/path/to/args.json
```

Avoid stuffing huge markdown into a single MCP XML argument (fragile).

### Document create template

```graphql
mutation($input: DocumentCreateInput!) {
  documentCreate(input: $input) {
    success
    document { id title url project { id name } }
  }
}
```

Variables:

```json
{
  "input": {
    "title": "…",
    "projectId": "<jarbas-project-uuid>",
    "content": "<markdown>"
  }
}
```

### Move project onto Jarbas (if misplaced)

```graphql
mutation($id: String!, $input: ProjectUpdateInput!) {
  projectUpdate(id: $id, input: $input) {
    success
    project { id name teams { nodes { id name } } url }
  }
}
```

Variables: `"input": { "teamIds": ["d9d01d53-e315-4810-b0ad-5f0e6139b35e"] }`

## Project naming heuristics

- Competitor / market research → project like **Competitor Analysis** (not mixed with pricing)
- Pricing / offers / commercial model → **Commercial Architecture** (or Billing & Launch if user prefers existing)
- Prefer **separate projects** when topics differ (e.g. competitors ≠ commercial architecture)
- Reuse an existing Jarbas project when the user is clearly continuing that workstream

## Quality bar

- Preserve user-provided links verbatim in the document and project update
- Keep documents structured (headings, tables, bottom line up top)
- Issues: title = outcome; description = context + **Done when**
- After writes, verify team is **Jarbas** (not Deploy Co Product / Reefo)
- Reply with clickable Linear URLs only — no dump of the full markdown in chat unless asked

## Known Jarbas team projects (examples; re-list if stale)

Created/used in this repo’s workflows:

- Competitor Analysis
- Commercial Architecture
- Billing & Launch
- Desktop & Distribution
- Connectors & Composio
- Redaction & Privacy
- Analysis & Reports
- Onboarding & Auth

Always re-query Linear rather than assuming IDs beyond the Jarbas team UUID above.
