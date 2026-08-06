export type Learning = {
  id: string;
  title: string;
  category: string;
  observed: string;
  insight: string;
  apps: string[];
  frequency: string;
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
  },
];
