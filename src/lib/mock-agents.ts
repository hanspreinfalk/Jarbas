export type AgentStatus = "running" | "idle" | "needs_review" | "queued";

export type Agent = {
  id: string;
  name: string;
  covers: string;
  status: AgentStatus;
  lastRun: string;
  lastRunAt: string;
  trigger: string;
  summary: string;
  runs7d: number;
  tools: string[];
  instructions: string;
  skills: string[];
  triggers: string[];
  approvals: string[];
  evals: string[];
  successRate: string;
  avgDuration: string;
  owner: string;
  relatedOpportunity: string;
};

export const MOCK_AGENTS: Agent[] = [
  {
    id: "billing-recon",
    name: "Billing Reconciliation Agent",
    covers: "Partner billing reconciliation",
    status: "running",
    lastRun: "Running now",
    lastRunAt: "Today · 3:12 PM",
    trigger: "Partner billing folder updated",
    summary:
      "Matching four partner workbooks and drafting the exception queue for Finance review.",
    runs7d: 4,
    tools: ["Google Drive", "Google Sheets", "Slack"],
    instructions:
      "Read the four partner workbooks from Drive. Match on policy_id with premium tolerance ±$1. Draft the exception queue and write reconciliation_report.md. Never post financial adjustments. Escalate exceptions over $5k to Finance Lead.",
    skills: [
      "Analyze partner workbooks",
      "Match policies across books",
      "Draft exception queue",
      "Write reconciliation report",
    ],
    triggers: [
      "1st business day · partner billing folder updated",
      "Manual run from #billing-recon",
      "Q1 close checkpoint on Calendar",
    ],
    approvals: ["Finance Lead for exceptions over $5k"],
    evals: [
      "All four xlsx files read before match",
      "Match keys = policy_id across workbooks",
      "No adjustment posted without Finance approval",
    ],
    successRate: "100%",
    avgDuration: "6m 22s",
    owner: "Hans",
    relatedOpportunity: "Drive intake agent for partner workbooks",
  },
  {
    id: "follow-up-pack",
    name: "Discovery Follow-up Agent",
    covers: "Same-day buyer follow-ups",
    status: "idle",
    lastRun: "Completed",
    lastRunAt: "Today · 11:40 AM",
    trigger: "Calendar discovery call ended",
    summary:
      "Drafted two follow-ups with the two-week delivery sketch prefilled for Meridian and Harbor.",
    runs7d: 6,
    tools: ["Gmail", "Calendar", "Notion"],
    instructions:
      "After a discovery call ends, draft a same-day follow-up using the two-week delivery pack. Personalize with company name and one call note. Do not send without review unless the template is marked auto-send.",
    skills: [
      "Pull calendar notes",
      "Fill follow-up template",
      "Attach delivery one-pager",
      "Queue Gmail draft",
    ],
    triggers: [
      "Calendar discovery call ended",
      "Manual run after buyer meeting",
    ],
    approvals: ["Hans reviews first send of the day"],
    evals: [
      "Two-week paragraph present",
      "Company name personalized",
      "Draft ready within 3 minutes",
    ],
    successRate: "100%",
    avgDuration: "48s",
    owner: "Hans",
    relatedOpportunity: "Discovery follow-up template pack",
  },
  {
    id: "exception-brief",
    name: "Exception Brief Agent",
    covers: "Finance exception packs",
    status: "needs_review",
    lastRun: "Needs review",
    lastRunAt: "Yesterday · 4:18 PM",
    trigger: "Thursday exception forum",
    summary:
      "Assembled variance, owner, and recommended action. Waiting on Finance Lead for exceptions over $5k.",
    runs7d: 2,
    tools: ["Google Sheets", "Slack", "Docs"],
    instructions:
      "Assemble the Thursday exception brief from the queue: variance, owner, recommended action. Flag items over $5k. Post pack to Slack and Docs. Do not approve exceptions.",
    skills: [
      "Export exception rows",
      "Format brief columns",
      "Flag high-dollar items",
      "Publish Docs / Slack pack",
    ],
    triggers: [
      "Thursday exception forum",
      "Exception queue updated before forum",
    ],
    approvals: ["Finance Lead for exceptions over $5k"],
    evals: [
      "Brief includes variance, owner, action",
      "Items over $5k are flagged",
      "Pack posted before forum start",
    ],
    successRate: "100%",
    avgDuration: "1m 48s",
    owner: "Hans + Finance",
    relatedOpportunity: "Finance exception brief pack",
  },
  {
    id: "demo-reset",
    name: "Demo Snapshot Agent",
    covers: "Buyer demo environment reset",
    status: "idle",
    lastRun: "Completed",
    lastRunAt: "Tue · 9:05 AM",
    trigger: "Manual run before demo",
    summary:
      "Restored the frozen demo dataset and verified the exception queue path before the buyer call.",
    runs7d: 3,
    tools: ["Jarbas", "Chrome"],
    instructions:
      "Restore the frozen demo snapshot, verify the exception queue path, and confirm sample records match the two-week delivery story. Never mutate production data.",
    skills: [
      "Restore frozen snapshot",
      "Verify exception queue path",
      "Confirm sample records",
    ],
    triggers: [
      "Manual run before demo",
      "Pre-call checklist item",
    ],
    approvals: ["Hans confirms restore before buyer joins"],
    evals: [
      "Snapshot restore under 2 minutes",
      "Exception queue path reachable",
      "Sample records match approved set",
    ],
    successRate: "100%",
    avgDuration: "1m 12s",
    owner: "Hans",
    relatedOpportunity: "Frozen demo environment snapshot",
  },
  {
    id: "commission-guard",
    name: "Commission Guard",
    covers: "Commission dispute desk",
    status: "queued",
    lastRun: "Not yet live",
    lastRunAt: "Never",
    trigger: "commissions.xlsx uploaded",
    summary:
      "Designed and queued. Will compare commission rates and draft dispute emails for approval.",
    runs7d: 0,
    tools: ["Google Drive", "Google Sheets", "Gmail"],
    instructions:
      "Compare commission_rate in commissions.xlsx to expected rates in internal_policies.xlsx. Attach partner schedule evidence. Draft carrier dispute emails for Finance Lead approval. Never send without approval.",
    skills: [
      "Compare commission rates",
      "Find partner schedule evidence",
      "Draft dispute email",
      "Update exception queue",
    ],
    triggers: [
      "commissions.xlsx uploaded to partner billing folder",
      "Rate drift flagged in recon run",
    ],
    approvals: ["Finance Lead for carrier disputes"],
    evals: [
      "Drift threshold = 1 percentage point",
      "Dispute draft includes policy_id and evidence",
      "No carrier email sent without approval",
    ],
    successRate: " - ",
    avgDuration: " - ",
    owner: "Hans + Finance",
    relatedOpportunity: "Finance exception brief pack",
  },
  {
    id: "theme-sync",
    name: "Theme Capture Agent",
    covers: "Call themes → opportunities",
    status: "idle",
    lastRun: "Completed",
    lastRunAt: "Mon · 6:22 PM",
    trigger: "Meeting notes saved",
    summary:
      "Tagged three call themes and opened opportunity cards for delivery one-pager and demo snapshot.",
    runs7d: 5,
    tools: ["Jarbas", "Notion", "Linear"],
    instructions:
      "When meeting notes are saved, tag themes and open opportunity stubs on the board. Prefer high-signal themes tied to delivery unlocks. Do not invent ROI figures.",
    skills: [
      "Extract call themes",
      "Tag opportunities",
      "Open opportunity stubs",
      "Link related learnings",
    ],
    triggers: [
      "Meeting notes saved",
      "Ask theme capture request",
    ],
    approvals: ["Hans reviews new stubs weekly"],
    evals: [
      "Theme becomes a card the same day",
      "Stub links to source notes",
      "No duplicate opportunity titles",
    ],
    successRate: "100%",
    avgDuration: "36s",
    owner: "Hans",
    relatedOpportunity: "Theme → opportunity sync",
  },
];
