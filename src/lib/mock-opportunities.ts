export type Opportunity = {
  id: string;
  title: string;
  category: string;
  signal: string;
  unlock: string;
  impact: string;
  effort: string;
  horizon: string;
  apps: string[];
  whyNow: string;
  successMetric: string;
  owner: string;
  relatedLearning: string;
  hoursSavedPerCycle: string;
  deliveryPlan: string[];
  prerequisites: string[];
  risks: string[];
};

export const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: "drive-intake-agent",
    title: "Drive intake agent for partner workbooks",
    category: "Automation",
    signal:
      "Every close cycle you manually pull the same four partner workbooks from Drive before match work starts.",
    unlock:
      "An intake agent can stage the files and open the match template so you start at exception review.",
    impact: "High",
    effort: "Medium",
    horizon: "2 weeks",
    apps: ["Google Drive", "Google Sheets", "Slack"],
    whyNow:
      "The intake sequence is stable across the last six close cycles, so an agent can own the repeatable front half without changing Finance judgment.",
    successMetric: "Close starts at exception review within 5 minutes of folder update",
    owner: "Hans",
    relatedLearning: "Monthly partner billing close",
    hoursSavedPerCycle: "3–4 hours",
    deliveryPlan: [
      "Lock the four workbook names and folder path",
      "Stage files into the frozen match template",
      "Notify Slack when intake is ready",
      "Hand off to exception review",
    ],
    prerequisites: [
      "Stable partner billing folder layout",
      "Match workbook template from last close",
      "Drive connector connected",
    ],
    risks: [
      "Folder rename or new workbook names break intake",
      "Finance still needs a human for exceptions over $5k",
    ],
  },
  {
    id: "follow-up-template-pack",
    title: "Discovery follow-up template pack",
    category: "Communication",
    signal:
      "Same-day follow-ups after discovery calls are rewritten from scratch with the same two-week delivery framing.",
    unlock:
      "A reusable pack keeps the core message fixed and leaves room for call-specific notes.",
    impact: "High",
    effort: "Low",
    horizon: "2 days",
    apps: ["Gmail", "Notion", "Calendar"],
    whyNow:
      "The two-week delivery paragraph already resonates. Shipping a pack this week compounds every upcoming discovery call.",
    successMetric: "Follow-up draft ready in under 3 minutes after each call",
    owner: "Hans",
    relatedLearning: "Same-day follow-up drafting",
    hoursSavedPerCycle: "1–2 hours / week",
    deliveryPlan: [
      "Extract the shared two-week opening",
      "Add slots for company name and one call note",
      "Publish pack in Notion + Gmail snippet",
      "Use on the next two discovery calls",
    ],
    prerequisites: [
      "Approved two-week delivery wording",
      "Gmail / Notion access",
    ],
    risks: [
      "Over-templating can feel generic if call notes are skipped",
    ],
  },
  {
    id: "exception-brief-pack",
    title: "Finance exception brief pack",
    category: "Decision support",
    signal:
      "Exception tables are formatted by hand before Thursday reviews with Finance Lead.",
    unlock:
      "Auto-assemble variance, owner, and recommended action so the meeting stays on decisions.",
    impact: "Medium",
    effort: "Low",
    horizon: "1 week",
    apps: ["Google Sheets", "Slack", "Docs"],
    whyNow:
      "The brief structure has not changed in five close cycles. Assembly is pure prep, not judgment.",
    successMetric: "Thursday forum opens with a ready brief every close week",
    owner: "Hans + Finance",
    relatedLearning: "Finance exception briefing",
    hoursSavedPerCycle: "1.5 hours",
    deliveryPlan: [
      "Map exception queue columns to brief fields",
      "Generate Docs/Slack pack automatically",
      "Flag items over $5k for Finance Lead",
      "Run once in the next close cycle",
    ],
    prerequisites: [
      "Exception queue with variance / owner / action",
      "Thursday forum cadence locked",
    ],
    risks: [
      "Bad source rows produce a confident but wrong brief",
    ],
  },
  {
    id: "frozen-demo-snapshot",
    title: "Frozen demo environment snapshot",
    category: "Delivery",
    signal:
      "Demo prep rebuilds sample data and the exception queue path before buyer calls.",
    unlock:
      "One-click restore keeps the two-week delivery story consistent and shortens prep.",
    impact: "High",
    effort: "Medium",
    horizon: "1 week",
    apps: ["Jarbas", "Chrome", "Notion"],
    whyNow:
      "Buyer conversations are accelerating. Consistent demos protect the two-week story better than ad-hoc resets.",
    successMetric: "Demo ready in under 2 minutes before a call",
    owner: "Hans",
    relatedLearning: "Demo environment reset",
    hoursSavedPerCycle: "45–75 minutes per demo",
    deliveryPlan: [
      "Capture a clean demo dataset",
      "Script one-click restore",
      "Verify exception queue path",
      "Attach restore step to pre-call checklist",
    ],
    prerequisites: [
      "Approved sample records",
      "Stable exception queue path in the shell",
    ],
    risks: [
      "Snapshot drifts if product UI changes without refresh",
    ],
  },
  {
    id: "theme-opportunity-sync",
    title: "Theme → opportunity sync",
    category: "Capture",
    signal:
      "Call themes land in notes, memory, and the opportunities board separately, often days apart.",
    unlock:
      "Capture once and fan themes into opportunity cards automatically.",
    impact: "High",
    effort: "Medium",
    horizon: "2 weeks",
    apps: ["Jarbas", "Notion", "Linear"],
    whyNow:
      "Themes are already being written down. The gap is fan-out speed into the opportunities board.",
    successMetric: "New call theme becomes an opportunity card the same day",
    owner: "Hans",
    relatedLearning: "Mid-task tool hopping",
    hoursSavedPerCycle: "2 hours / week",
    deliveryPlan: [
      "Define theme tags from recent calls",
      "Capture once from notes or Ask",
      "Auto-create opportunity stubs",
      "Review weekly for packaging",
    ],
    prerequisites: [
      "Shared theme taxonomy",
      "Opportunities board as the system of record",
    ],
    risks: [
      "Noisy themes can create low-quality opportunity stubs",
    ],
  },
  {
    id: "delivery-one-pager",
    title: "Partner-billing delivery one-pager",
    category: "Packaging",
    signal:
      "ROI framing for the two-week delivery sketch is rebuilt for each buyer conversation.",
    unlock:
      "A durable one-pager makes the offer shareable without rewriting the story.",
    impact: "High",
    effort: "Low",
    horizon: "3 days",
    apps: ["Docs", "Notion", "Gmail"],
    whyNow:
      "Meridian and similar buyers keep asking for a shareable sketch. One durable page unblocks follow-ups this week.",
    successMetric: "One-pager attached to every discovery follow-up",
    owner: "Hans",
    relatedLearning: "Same-day follow-up drafting",
    hoursSavedPerCycle: "2 hours / week",
    deliveryPlan: [
      "Draft two-week delivery sketch once",
      "Add ROI and scope boundaries",
      "Publish shareable Docs link",
      "Attach in the follow-up pack",
    ],
    prerequisites: [
      "Approved two-week delivery wording",
      "Clear scope for partner billing close",
    ],
    risks: [
      "Stale numbers if ROI claims are not refreshed monthly",
    ],
  },
];
