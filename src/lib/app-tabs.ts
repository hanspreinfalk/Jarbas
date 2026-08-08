import type { ComponentType } from "react";
import {
  // Activity,
  AudioLines,
  BookOpen,
  // Bot,
  CreditCard,
  FileBarChart,
  MessageSquare,
  Network,
  Plug,
  Settings,
  Sparkles,
} from "lucide-react";

export type AppTabId =
  | "recording"
  | "insights"
  | "opportunities"
  | "reports"
  | "agents"
  | "observability"
  | "connectors"
  | "settings"
  | "billing"
  | "redactions"
  | "privacy"
  | "ask"
  | "multi-team-analysis";

export type AppTab = {
  id: AppTabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Shown only when Clerk org role is `org:admin`. */
  adminOnly?: boolean;
};

/** Labels for pages that are not always in the sidebar (e.g. settings subpages). */
export const APP_PAGE_LABELS: Record<AppTabId, string> = {
  ask: "Ask",
  recording: "Learning",
  connectors: "Connectors",
  insights: "Insights",
  opportunities: "Opportunities",
  reports: "Reports",
  agents: "Agents",
  observability: "Observability",
  settings: "Settings",
  billing: "Pricing",
  redactions: "Redactions",
  privacy: "How Jarbas uses data",
  "multi-team-analysis": "Team analysis",
};

export const APP_TABS: AppTab[] = [
  {
    id: "ask",
    label: "Ask",
    icon: MessageSquare,
  },
  {
    id: "recording",
    label: "Learning",
    icon: AudioLines,
  },
  {
    id: "connectors",
    label: "Connectors",
    icon: Plug,
  },
  {
    id: "insights",
    label: "Insights",
    icon: BookOpen,
  },
  {
    id: "opportunities",
    label: "Opportunities",
    icon: Sparkles,
  },
  {
    id: "reports",
    label: "Reports",
    icon: FileBarChart,
  },
  {
    id: "multi-team-analysis",
    label: "Team analysis",
    icon: Network,
    adminOnly: true,
  },
  // {
  //   id: "agents",
  //   label: "Agents",
  //   icon: Bot,
  // },
  // {
  //   id: "observability",
  //   label: "Observability",
  //   icon: Activity,
  // },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
  },
  {
    id: "billing",
    label: "Pricing",
    icon: CreditCard,
  },
];

export function visibleAppTabs(isOrgAdmin: boolean): AppTab[] {
  return APP_TABS.filter((tab) => !tab.adminOnly || isOrgAdmin);
}
