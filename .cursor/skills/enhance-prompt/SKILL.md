---
name: enhance-prompt
description: >-
  Rewrites a rough user prompt into a clearer, more rigorous, decision-useful
  prompt while preserving original intent. Use when the user asks to improve,
  enhance, rewrite, refine, strengthen, or upgrade a prompt, or pastes draft
  instructions and wants a better version to send to an agent.
---

# Enhance Prompt

Turn a rough, casual, or underspecified prompt into a high-quality prompt the user can paste into another chat/agent.

## Goal

Preserve the user's intent. Amplify clarity, structure, depth, evidence standards, and decision usefulness. Do **not** invent a different task.

## Workflow

1. Read the draft prompt carefully.
2. Extract:
   - Primary ask(s)
   - Constraints, names, scope, and non-negotiables
   - Implicit quality bar ("good", "thorough", "useful", etc.)
   - Domain context available in the conversation/repo (only if relevant)
3. Rewrite into an improved prompt.
4. Return the improved prompt as the main deliverable. Optionally add a short bullet list of what you strengthened — keep that secondary and brief.

## Rewrite rules

### Keep

- The original objective and any explicit artifacts to create (projects, docs, analyses, code, etc.)
- Named entities, team names, product names, and hard constraints
- The user's voice when it is already clear; clean filler without sterilizing meaning

### Upgrade

- Vague verbs (`look into`, `do some`, `make something good`) → concrete deliverables and success criteria
- Casual asides → crisp instructions
- Thin asks → the minimum structure needed for an excellent result
- Open-ended research → method + source diversity + evidence standards
- Comparative work → explicit evaluation dimensions + synthesis that drives decisions
- Output requests → required structure, formats, and how to mark uncertainty

### Never

- Hardcode examples from this skill into the rewrite
- Swap the task for a "better" task the user did not ask for
- Add fake requirements, fake stakeholders, or fake product pillars
- Overfit to one domain (competitor analysis, code review, etc.) — generalize from the draft
- Bloat with generic AI boilerplate ("You are a world-class expert…") unless the draft needs a role for quality

## What "better" usually means

Apply only the upgrades that fit the draft:

| If the draft… | Strengthen by adding… |
|---|---|
| Asks for research | Scope boundaries, competitor/source categories if relevant, non-marketing sources, fact vs assumption labeling, citations for important claims |
| Asks for comparison | Evaluation axes, strengths/weaknesses, learn-vs-avoid, matrices or maps when useful |
| Asks for analysis of a product/repo | Grounding step first (understand current state, architecture, goals, limits) before recommendations |
| Asks for strategy/roadmap help | Decision questions, prioritization, what not to do, white space, moat/defensibility if relevant |
| Asks for creation/build work | Acceptance criteria, constraints, edge cases, definition of done |
| Asks for writing/comms | Audience, tone, length, structure, must-include / must-avoid |
| Is underspecified on output | Explicit sections, artifacts, and revisitability ("structured, easy to update later") |

## Prompt shape (adapt, don't force)

Use this skeleton only when it fits; drop empty sections:

```markdown
[Clean restatement of the core ask]

[Context / grounding the agent should do first]

[Scope: include / exclude / look broadly for]

[Work method: steps, research standards, evaluation dimensions]

[Required artifacts: matrices, maps, docs, code, checklists — only if useful]

[Synthesis / decision questions the output must answer]

[Output quality bar: structure, sources, facts vs assumptions, usefulness]
```

Prefer scannable bullets and numbered priorities over walls of prose.

## Quality bar for the improved prompt

The rewrite should make the downstream agent:

1. Understand exactly what to produce
2. Know how deep to go and what "good" looks like
3. Ground claims in evidence and separate facts from inference
4. Optimize for decisions or usable artifacts, not ornamental completeness
5. Stay faithful to the user's actual request

## Output format

Respond with:

1. The improved prompt in a single fenced markdown block (ready to copy)
2. Optional: 2–5 short bullets on what changed (clarity, scope, method, artifacts, decision lens)

Do not execute the improved prompt unless the user asks you to run it.
