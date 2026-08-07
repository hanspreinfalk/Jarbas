export type AgentRunStatus =
  | "running"
  | "completed"
  | "needs_review"
  | "failed";

export type AgentRunStepStatus = "done" | "active" | "pending" | "failed";

export type AgentRunStep = {
  id: string;
  label: string;
  detail: string;
  status: AgentRunStepStatus;
  at: string;
  duration?: string;
};

export type AgentRunEvent = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  message: string;
};

export type AgentRun = {
  id: string;
  agent: string;
  title: string;
  trigger: string;
  summary: string;
  status: AgentRunStatus;
  startedAt: string;
  duration: string;
  steps: number;
  tools: string[];
  owner: string;
  model: string;
  cost: string;
  tokensIn: string;
  tokensOut: string;
  workspace: string;
  inputs: string[];
  outputs: string[];
  timeline: AgentRunStep[];
  events: AgentRunEvent[];
  nextAction?: string;
};

export const MOCK_AGENT_RUNS: AgentRun[] = [
  {
    id: "run-billing-live",
    agent: "Billing Reconciliation Agent",
    title: "Q1 partner billing recon · live close pack",
    trigger: "Email · finance@ · four workbooks attached",
    summary:
      "Reading the four xlsx attachments, matching on policy_id, and drafting reconciliation_report.md for Finance Lead.",
    status: "running",
    startedAt: "Just now",
    duration: "In progress",
    steps: 6,
    tools: ["Gmail", "Google Drive", "Google Sheets"],
    owner: "Finance Lead",
    model: "claude-sonnet-4",
    cost: "$0.18 so far",
    tokensIn: "42.1k",
    tokensOut: "6.4k",
    workspace: "Meridian Partners",
    inputs: [
      "Q1_Partner_A.xlsx",
      "Q1_Partner_B.xlsx",
      "Q1_Partner_C.xlsx",
      "Q1_Partner_D.xlsx",
      "Email thread · finance@ · close pack",
    ],
    outputs: [
      "Draft · reconciliation_report.md",
      "Exception queue · 11 rows staged",
    ],
    timeline: [
      {
        id: "s1",
        label: "Ingest attachments",
        detail: "Pulled four workbooks from Gmail into Drive staging.",
        status: "done",
        at: "0s",
        duration: "8s",
      },
      {
        id: "s2",
        label: "Normalize columns",
        detail: "Aligned policy_id, premium, and commission fields.",
        status: "done",
        at: "8s",
        duration: "14s",
      },
      {
        id: "s3",
        label: "Match on policy_id",
        detail: "Comparing partner rows against ledger sheet.",
        status: "active",
        at: "22s",
      },
      {
        id: "s4",
        label: "Flag exceptions",
        detail: "Premium and rate mismatches pending.",
        status: "pending",
        at: " - ",
      },
      {
        id: "s5",
        label: "Draft report",
        detail: "Write reconciliation_report.md with executive brief.",
        status: "pending",
        at: " - ",
      },
      {
        id: "s6",
        label: "Route for review",
        detail: "Notify Finance Lead when the pack is ready.",
        status: "pending",
        at: " - ",
      },
    ],
    events: [
      {
        id: "e1",
        at: "0.2s",
        level: "info",
        message: "Run started from Gmail trigger.",
      },
      {
        id: "e2",
        at: "7.8s",
        level: "info",
        message: "Staged 4 workbooks in Drive /close/Q1.",
      },
      {
        id: "e3",
        at: "21.4s",
        level: "info",
        message: "Match pass started · 186 candidate rows.",
      },
      {
        id: "e4",
        at: "34.1s",
        level: "warn",
        message: "Sheet API latency high on Partner_C · retrying once.",
      },
    ],
    nextAction: "Finish match pass, then open exception pack for Finance Lead.",
  },
  {
    id: "run-follow-up",
    agent: "Discovery Follow-up Agent",
    title: "Meridian discovery follow-up",
    trigger: "Calendar discovery call ended",
    summary:
      "Drafted a same-day follow-up with the two-week delivery sketch and booked a workflow walkthrough.",
    status: "completed",
    startedAt: "Today · 11:40 AM",
    duration: "48s",
    steps: 4,
    tools: ["Gmail", "Calendar", "Notion"],
    owner: "Hans Preinfalk",
    model: "claude-sonnet-4",
    cost: "$0.07",
    tokensIn: "18.2k",
    tokensOut: "2.1k",
    workspace: "Deployment Company",
    inputs: [
      "Calendar event · Meridian discovery",
      "Call notes · Meridian",
      "Prior opportunity cards",
    ],
    outputs: [
      "Email draft · Meridian follow-up",
      "Calendar hold · workflow walkthrough",
      "Notion page · discovery summary",
    ],
    timeline: [
      {
        id: "s1",
        label: "Pull call notes",
        detail: "Loaded Meridian discovery notes and themes.",
        status: "done",
        at: "0s",
        duration: "6s",
      },
      {
        id: "s2",
        label: "Draft follow-up",
        detail: "Wrote same-day note with two-week delivery sketch.",
        status: "done",
        at: "6s",
        duration: "22s",
      },
      {
        id: "s3",
        label: "Book walkthrough",
        detail: "Proposed two slots and held Thursday 2:00 PM.",
        status: "done",
        at: "28s",
        duration: "12s",
      },
      {
        id: "s4",
        label: "Log in Notion",
        detail: "Saved discovery summary and next steps.",
        status: "done",
        at: "40s",
        duration: "8s",
      },
    ],
    events: [
      {
        id: "e1",
        at: "0.1s",
        level: "info",
        message: "Trigger · calendar event ended.",
      },
      {
        id: "e2",
        at: "27.5s",
        level: "info",
        message: "Follow-up draft ready for send.",
      },
      {
        id: "e3",
        at: "47.9s",
        level: "info",
        message: "Run completed.",
      },
    ],
  },
  {
    id: "run-billing-complete",
    agent: "Billing Reconciliation Agent",
    title: "Q1 partner billing recon · four workbooks",
    trigger: "Manual run from #billing-recon",
    summary:
      "Matched 12 policies, flagged 11 exceptions, and wrote reconciliation_report.md with executive summary and exception pack.",
    status: "completed",
    startedAt: "Today · 10:05 AM",
    duration: "6m 22s",
    steps: 8,
    tools: ["Google Drive", "Google Sheets"],
    owner: "Finance Lead",
    model: "claude-sonnet-4",
    cost: "$0.41",
    tokensIn: "96.4k",
    tokensOut: "11.8k",
    workspace: "Meridian Partners",
    inputs: [
      "Partner billing folder · Q1",
      "Ledger sheet · closed books",
      "Prior exception rules",
    ],
    outputs: [
      "reconciliation_report.md",
      "Exception pack · 11 items",
      "Slack note · #billing-recon",
    ],
    timeline: [
      {
        id: "s1",
        label: "Load partner folder",
        detail: "Opened four workbooks from Drive.",
        status: "done",
        at: "0s",
        duration: "41s",
      },
      {
        id: "s2",
        label: "Match policies",
        detail: "Matched 12 policies on policy_id.",
        status: "done",
        at: "41s",
        duration: "2m 18s",
      },
      {
        id: "s3",
        label: "Exception scan",
        detail: "Flagged 11 premium / rate exceptions.",
        status: "done",
        at: "2m 59s",
        duration: "1m 44s",
      },
      {
        id: "s4",
        label: "Write report",
        detail: "Published reconciliation_report.md and pack.",
        status: "done",
        at: "4m 43s",
        duration: "1m 39s",
      },
    ],
    events: [
      {
        id: "e1",
        at: "0s",
        level: "info",
        message: "Manual run from #billing-recon.",
      },
      {
        id: "e2",
        at: "3m 12s",
        level: "warn",
        message: "POL-10034 premium mismatch above threshold.",
      },
      {
        id: "e3",
        at: "6m 22s",
        level: "info",
        message: "Report published · Finance Lead notified.",
      },
    ],
  },
  {
    id: "run-exception",
    agent: "Exception Brief Agent",
    title: "Exception queue draft · POL-10034",
    trigger: "Thursday exception forum",
    summary:
      "Logged premium mismatch POL-10034 and routed to Finance Lead for approval.",
    status: "needs_review",
    startedAt: "Yesterday · 4:18 PM",
    duration: "1m 48s",
    steps: 3,
    tools: ["Google Sheets", "Slack"],
    owner: "Finance Lead",
    model: "claude-haiku-4",
    cost: "$0.03",
    tokensIn: "9.4k",
    tokensOut: "1.2k",
    workspace: "Meridian Partners",
    inputs: [
      "Exception queue · Thursday forum",
      "POL-10034 ledger row",
      "Partner_B workbook row",
    ],
    outputs: [
      "Exception brief · POL-10034",
      "Slack approval request · Finance Lead",
    ],
    timeline: [
      {
        id: "s1",
        label: "Pull mismatch",
        detail: "Loaded POL-10034 premium delta.",
        status: "done",
        at: "0s",
        duration: "18s",
      },
      {
        id: "s2",
        label: "Draft brief",
        detail: "Wrote forum-ready exception brief.",
        status: "done",
        at: "18s",
        duration: "52s",
      },
      {
        id: "s3",
        label: "Request approval",
        detail: "Waiting on Finance Lead in Slack.",
        status: "done",
        at: "1m 10s",
        duration: "38s",
      },
    ],
    events: [
      {
        id: "e1",
        at: "0s",
        level: "info",
        message: "Forum trigger fired.",
      },
      {
        id: "e2",
        at: "1m 48s",
        level: "warn",
        message: "Approval pending · Finance Lead.",
      },
    ],
    nextAction: "Finance Lead approve or reject POL-10034 brief.",
  },
  {
    id: "run-demo",
    agent: "Demo Snapshot Agent",
    title: "Frozen demo restore · buyer call",
    trigger: "Manual run before demo",
    summary:
      "Restored the frozen demo dataset and verified the exception queue path before the buyer call.",
    status: "completed",
    startedAt: "Tue · 9:05 AM",
    duration: "1m 12s",
    steps: 3,
    tools: ["Jarbas", "Chrome"],
    owner: "Hans Preinfalk",
    model: "claude-haiku-4",
    cost: "$0.02",
    tokensIn: "4.1k",
    tokensOut: "0.6k",
    workspace: "Deployment Company",
    inputs: ["Frozen demo snapshot · v12", "Buyer call agenda"],
    outputs: ["Demo workspace restored", "Exception path smoke check · pass"],
    timeline: [
      {
        id: "s1",
        label: "Restore snapshot",
        detail: "Loaded frozen demo dataset v12.",
        status: "done",
        at: "0s",
        duration: "38s",
      },
      {
        id: "s2",
        label: "Verify exception path",
        detail: "Opened queue and confirmed sample POL rows.",
        status: "done",
        at: "38s",
        duration: "24s",
      },
      {
        id: "s3",
        label: "Ready signal",
        detail: "Marked demo workspace ready for call.",
        status: "done",
        at: "1m 02s",
        duration: "10s",
      },
    ],
    events: [
      {
        id: "e1",
        at: "0s",
        level: "info",
        message: "Manual restore started.",
      },
      {
        id: "e2",
        at: "1m 12s",
        level: "info",
        message: "Demo ready.",
      },
    ],
  },
  {
    id: "run-commission",
    agent: "Commission Guard",
    title: "Commission drift · POL-10027",
    trigger: "Rate drift flagged in recon run",
    summary:
      "Detected 9% expected vs 7% posted for Riverton Schools. Dispute draft pending Finance Lead approval.",
    status: "needs_review",
    startedAt: "Mon · 3:40 PM",
    duration: "2m 05s",
    steps: 4,
    tools: ["Google Drive", "Gmail"],
    owner: "Finance Lead",
    model: "claude-sonnet-4",
    cost: "$0.09",
    tokensIn: "21.6k",
    tokensOut: "3.4k",
    workspace: "Meridian Partners",
    inputs: [
      "POL-10027 commission row",
      "Riverton Schools contract excerpt",
      "Prior dispute template",
    ],
    outputs: [
      "Dispute draft · POL-10027",
      "Email draft · partner notice",
    ],
    timeline: [
      {
        id: "s1",
        label: "Confirm drift",
        detail: "9% expected vs 7% posted.",
        status: "done",
        at: "0s",
        duration: "28s",
      },
      {
        id: "s2",
        label: "Pull contract terms",
        detail: "Loaded Riverton commission schedule.",
        status: "done",
        at: "28s",
        duration: "36s",
      },
      {
        id: "s3",
        label: "Draft dispute",
        detail: "Prepared partner notice and internal brief.",
        status: "done",
        at: "1m 04s",
        duration: "48s",
      },
      {
        id: "s4",
        label: "Await approval",
        detail: "Held for Finance Lead before send.",
        status: "done",
        at: "1m 52s",
        duration: "13s",
      },
    ],
    events: [
      {
        id: "e1",
        at: "0s",
        level: "warn",
        message: "Rate drift threshold crossed for POL-10027.",
      },
      {
        id: "e2",
        at: "2m 05s",
        level: "warn",
        message: "Dispute draft waiting on approval.",
      },
    ],
    nextAction: "Approve dispute draft to notify the partner.",
  },
  {
    id: "run-theme",
    agent: "Theme Capture Agent",
    title: "Call themes → opportunity cards",
    trigger: "Meeting notes saved",
    summary:
      "Tagged three call themes and opened opportunity cards for delivery one-pager and demo snapshot.",
    status: "completed",
    startedAt: "Mon · 6:22 PM",
    duration: "36s",
    steps: 5,
    tools: ["Jarbas", "Notion", "Linear"],
    owner: "Hans Preinfalk",
    model: "claude-haiku-4",
    cost: "$0.04",
    tokensIn: "12.8k",
    tokensOut: "1.9k",
    workspace: "Deployment Company",
    inputs: ["Meeting notes · Meridian + Summit", "Existing opportunity board"],
    outputs: [
      "3 theme tags",
      "Opportunity · delivery one-pager",
      "Opportunity · demo snapshot",
    ],
    timeline: [
      {
        id: "s1",
        label: "Read notes",
        detail: "Parsed saved meeting notes.",
        status: "done",
        at: "0s",
        duration: "7s",
      },
      {
        id: "s2",
        label: "Tag themes",
        detail: "Extracted delivery clarity, ROI pack, demo freeze.",
        status: "done",
        at: "7s",
        duration: "14s",
      },
      {
        id: "s3",
        label: "Open cards",
        detail: "Created two opportunity cards in Linear/Notion.",
        status: "done",
        at: "21s",
        duration: "15s",
      },
    ],
    events: [
      {
        id: "e1",
        at: "0s",
        level: "info",
        message: "Notes saved trigger.",
      },
      {
        id: "e2",
        at: "36s",
        level: "info",
        message: "Opportunity cards created.",
      },
    ],
  },
  {
    id: "run-failed",
    agent: "Billing Reconciliation Agent",
    title: "Partner folder sync · Drive timeout",
    trigger: "Partner billing folder updated",
    summary:
      "Drive listing timed out before all four workbooks were staged. Retry queued for the next close window.",
    status: "failed",
    startedAt: "Sun · 8:14 AM",
    duration: "12s",
    steps: 2,
    tools: ["Google Drive"],
    owner: "Finance Lead",
    model: "claude-haiku-4",
    cost: "$0.01",
    tokensIn: "2.2k",
    tokensOut: "0.3k",
    workspace: "Meridian Partners",
    inputs: ["Partner billing folder · update event"],
    outputs: ["Retry job · queued for next close window"],
    timeline: [
      {
        id: "s1",
        label: "List Drive folder",
        detail: "Started listing partner billing folder.",
        status: "failed",
        at: "0s",
        duration: "12s",
      },
      {
        id: "s2",
        label: "Stage workbooks",
        detail: "Skipped · listing never completed.",
        status: "pending",
        at: " - ",
      },
    ],
    events: [
      {
        id: "e1",
        at: "0s",
        level: "info",
        message: "Folder update trigger received.",
      },
      {
        id: "e2",
        at: "12s",
        level: "error",
        message: "Google Drive listFiles timed out after 12s.",
      },
      {
        id: "e3",
        at: "12.1s",
        level: "warn",
        message: "Retry queued for next close window.",
      },
    ],
    nextAction: "Retry sync when Drive is healthy, or run manually from #billing-recon.",
  },
];
