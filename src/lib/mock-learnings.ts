export type Learning = {
  id: string;
  title: string;
  category: string;
  observed: string;
  insight: string;
  apps: string[];
  frequency: string;
  firstSeen: string;
  lastSeen: string;
  confidence: string;
  evidence: string[];
  steps: string[];
  relatedOpportunity: string;
  nextAction: string;
  timePattern: string;
};

export const MOCK_LEARNINGS: Learning[] = [
  {
    id: "billing-close-loop",
    title: "Monthly partner billing close",
    category: "Workflow",
    observed:
      "You open Drive, pull four partner workbooks, rebuild match tabs in Sheets, then draft a reconciliation note for Finance.",
    insight:
      "The intake and match steps follow the same sequence every cycle. Exception review is where your judgment matters most.",
    apps: ["Google Drive", "Google Sheets", "Slack", "Linear"],
    frequency: "Weekly close window",
    firstSeen: "6 weeks ago",
    lastSeen: "Yesterday · 2:14 PM",
    confidence: "High",
    evidence: [
      "12 close sessions with the same Drive → Sheets → Slack sequence",
      "Match workbook rebuilt from blank 9 of 12 times",
      "Exception review started only after intake finished every cycle",
    ],
    steps: [
      "Open partner billing folder in Drive",
      "Pull four workbooks into a fresh match sheet",
      "Rebuild policy_id match tabs",
      "Draft reconciliation note for Finance",
      "Post status in Slack / Linear",
    ],
    relatedOpportunity: "Drive intake agent for partner workbooks",
    nextAction: "Freeze last cycle's match workbook as the default template",
    timePattern: "Heaviest Tue–Thu mornings during close week",
  },
  {
    id: "context-switch-stack",
    title: "Mid-task tool hopping",
    category: "Focus pattern",
    observed:
      "During deep reconciliation blocks you jump Sheets → Linear → Slack to update status, then return to the same match row.",
    insight:
      "Status updates interrupt continuous match work. Batching them at the end of a block would protect the deep-work window.",
    apps: ["Google Sheets", "Linear", "Slack"],
    frequency: "Several times per close day",
    firstSeen: "5 weeks ago",
    lastSeen: "Today · 10:40 AM",
    confidence: "High",
    evidence: [
      "Average 7 tool hops per 45-minute match block",
      "Status posts cluster mid-block, not at natural breakpoints",
      "Return-to-row delay averages 40–70 seconds after each hop",
    ],
    steps: [
      "Work a match row in Sheets",
      "Jump to Linear for ticket status",
      "Reply or react in Slack",
      "Re-find the same Sheets row",
    ],
    relatedOpportunity: "Theme → opportunity sync",
    nextAction: "Batch status updates at the end of each match block",
    timePattern: "Peaks late morning on close days",
  },
  {
    id: "demo-reset-ritual",
    title: "Demo environment reset",
    category: "Prep ritual",
    observed:
      "Before buyer calls you rebuild sample data and walk the exception queue path in the desktop shell.",
    insight:
      "A frozen demo snapshot would cut prep time and keep the two-week delivery story consistent across calls.",
    apps: ["Jarbas", "Chrome", "Notion"],
    frequency: "Before discovery / demo calls",
    firstSeen: "4 weeks ago",
    lastSeen: "Tue · 8:50 AM",
    confidence: "Medium",
    evidence: [
      "Demo prep ran before 5 of the last 6 buyer calls",
      "Sample data rebuild took 12–18 minutes each time",
      "Exception queue walkthrough repeated the same 4 clicks",
    ],
    steps: [
      "Clear or rebuild sample records",
      "Seed partner workbook examples",
      "Walk exception queue path",
      "Open Notion talking points",
    ],
    relatedOpportunity: "Frozen demo environment snapshot",
    nextAction: "Save a one-click restore snapshot before the next demo",
    timePattern: "30–45 minutes before scheduled demos",
  },
  {
    id: "follow-up-rewrite",
    title: "Same-day follow-up drafting",
    category: "Communication",
    observed:
      "After discovery calls you rewrite similar follow-up emails that all lead with the two-week delivery sketch.",
    insight:
      "The core message is already clear. A reusable template would free time for opportunity packaging.",
    apps: ["Gmail", "Calendar", "Notion"],
    frequency: "After each discovery call",
    firstSeen: "5 weeks ago",
    lastSeen: "Today · 11:35 AM",
    confidence: "High",
    evidence: [
      "8 follow-ups shared the same two-week opening paragraph",
      "Personalization was limited to company name and one call note",
      "Draft time averaged 14 minutes per email",
    ],
    steps: [
      "Open calendar event notes",
      "Draft follow-up in Gmail",
      "Rewrite two-week delivery framing",
      "Add one call-specific detail",
      "Send same day",
    ],
    relatedOpportunity: "Discovery follow-up template pack",
    nextAction: "Lock a reusable follow-up pack with the two-week paragraph",
    timePattern: "Within 90 minutes after discovery calls",
  },
  {
    id: "theme-polish-loop",
    title: "UI polish verification loop",
    category: "Build habit",
    observed:
      "When shipping shell changes you toggle light/dark repeatedly and restart the app to check header and sidebar alignment.",
    insight:
      "Visual QA clusters in the afternoon. Batching chrome checks once per day keeps morning build blocks intact.",
    apps: ["Jarbas", "VS Code", "Terminal"],
    frequency: "During UI ship days",
    firstSeen: "3 weeks ago",
    lastSeen: "Mon · 4:05 PM",
    confidence: "Medium",
    evidence: [
      "Theme toggle bursts of 6–10 switches after chrome edits",
      "App restart used mainly to verify header/sidebar alignment",
      "Morning coding blocks stayed intact when polish moved to afternoon",
    ],
    steps: [
      "Ship shell or layout change",
      "Toggle light/dark",
      "Restart desktop app",
      "Check header and sidebar alignment",
      "Repeat for edge cases",
    ],
    relatedOpportunity: "Theme → opportunity sync",
    nextAction: "Run one chrome QA pass at end of day instead of mid-build",
    timePattern: "Afternoons on UI ship days",
  },
  {
    id: "exception-pack",
    title: "Finance exception briefing",
    category: "Decision forum",
    observed:
      "You format exception tables by hand before walking them with Finance Lead, usually on Thursday.",
    insight:
      "The brief structure is stable: variance, owner, recommended action. An agent can assemble the pack; you run the decision.",
    apps: ["Google Sheets", "Slack", "Docs"],
    frequency: "Each close cycle",
    firstSeen: "6 weeks ago",
    lastSeen: "Yesterday · 4:10 PM",
    confidence: "High",
    evidence: [
      "Thursday exception forums ran 5 consecutive close cycles",
      "Brief columns stayed variance / owner / recommended action",
      "Formatting took longer than the decision discussion",
    ],
    steps: [
      "Export exception rows from match sheet",
      "Format variance, owner, action columns",
      "Paste into Docs or Slack brief",
      "Walk decisions with Finance Lead",
    ],
    relatedOpportunity: "Finance exception brief pack",
    nextAction: "Auto-assemble the brief from the exception queue",
    timePattern: "Thursday afternoons in close week",
  },
];
