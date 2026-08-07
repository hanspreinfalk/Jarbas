import type { ComponentType } from "react";
import {
  Activity,
  AudioLines,
  BookOpen,
  Bot,
  FileBarChart,
  MessageSquare,
  Plug,
  Settings,
  Sparkles,
} from "lucide-react";

export type AppTabId =
  | "recording"
  | "learnings"
  | "opportunities"
  | "reports"
  | "agents"
  | "observability"
  | "connectors"
  | "settings"
  | "ask";

export type AppTab = {
  id: AppTabId;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export const APP_TABS: AppTab[] = [
  {
    id: "ask",
    label: "Ask",
    icon: MessageSquare,
  },
  {
    id: "recording",
    label: "Recording",
    icon: AudioLines,
  },
  {
    id: "connectors",
    label: "Connectors",
    icon: Plug,
  },
  {
    id: "learnings",
    label: "Learnings",
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
    id: "agents",
    label: "Agents",
    icon: Bot,
  },
  {
    id: "observability",
    label: "Observability",
    icon: Activity,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
  },
];
