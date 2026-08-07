import type { AnalysisKind, AnalysisToolCall } from "@/lib/analysis";

export type FriendlyPhaseId =
  | "starting"
  | "screen"
  | "apps"
  | "thinking"
  | "writing"
  | "finishing"
  | "stopping";

export type FriendlyPhase = {
  id: FriendlyPhaseId;
  label: string;
  done: boolean;
  active: boolean;
};

function toolBaseName(name: string) {
  return name.split("__").pop()?.toLowerCase() || name.toLowerCase();
}

function argsText(args: unknown): string {
  try {
    return JSON.stringify(args ?? {}).toLowerCase();
  } catch {
    return "";
  }
}

function classifyTool(tool: AnalysisToolCall): FriendlyPhaseId {
  const base = toolBaseName(tool.name);
  const blob = `${tool.label} ${argsText(tool.args)} ${tool.result}`.toLowerCase();

  if (
    blob.includes("composio") ||
    base.includes("composio") ||
    blob.includes("gmail") ||
    blob.includes("slack") ||
    blob.includes("calendar") ||
    blob.includes("notion") ||
    blob.includes("github") ||
    blob.includes("linear")
  ) {
    return "apps";
  }

  if (
    base === "write" ||
    base === "write_file" ||
    base === "edit" ||
    base === "apply_patch" ||
    blob.includes("analysis/jobs") ||
    blob.includes(".json")
  ) {
    return "writing";
  }

  if (
    base === "bash" ||
    base === "shell" ||
    base === "run_terminal_cmd" ||
    blob.includes("sqlite") ||
    blob.includes("ocr") ||
    blob.includes("frames") ||
    blob.includes("ui_events") ||
    blob.includes("db.sqlite") ||
    blob.includes("~/.jarbas") ||
    base === "read" ||
    base === "grep" ||
    base === "rg"
  ) {
    return "screen";
  }

  return "thinking";
}

const PHASE_ORDER: FriendlyPhaseId[] = [
  "starting",
  "screen",
  "apps",
  "thinking",
  "writing",
  "finishing",
];

const PHASE_LABEL: Record<FriendlyPhaseId, string> = {
  starting: "Getting started",
  screen: "Reviewing your screen activity",
  apps: "Checking connected apps",
  thinking: "Looking for patterns",
  writing: "Writing your results",
  finishing: "Wrapping up",
  stopping: "Stopping",
};

const TEAM_PHASE_LABEL: Record<FriendlyPhaseId, string> = {
  starting: "Getting started",
  screen: "Reading teammate reports",
  apps: "Comparing across people",
  thinking: "Synthesizing the team view",
  writing: "Writing the team report",
  finishing: "Wrapping up",
  stopping: "Stopping",
};

export function friendlyKindVerb(kind: AnalysisKind): string {
  switch (kind) {
    case "learnings":
      return "Finding patterns";
    case "opportunities":
      return "Finding opportunities";
    case "reports":
      return "Building your report";
    case "team-reports":
      return "Building team report";
  }
}

export function friendlyKindReady(kind: AnalysisKind): string {
  switch (kind) {
    case "learnings":
      return "Patterns ready";
    case "opportunities":
      return "Opportunities ready";
    case "reports":
      return "Your report is ready";
    case "team-reports":
      return "Your team report is ready";
  }
}

export function friendlyKindViewLabel(kind: AnalysisKind): string {
  switch (kind) {
    case "learnings":
      return "View patterns";
    case "opportunities":
      return "View opportunities";
    case "reports":
    case "team-reports":
      return "View report";
  }
}

export function friendlyPromptLabel(
  kind: AnalysisKind,
  rangeLabel: string,
): string {
  switch (kind) {
    case "learnings":
      return `Find patterns for ${rangeLabel}`;
    case "opportunities":
      return `Find opportunities for ${rangeLabel}`;
    case "reports":
      return `Build a full report for ${rangeLabel}`;
    case "team-reports":
      return `Build a team report for ${rangeLabel}`;
  }
}

/** Map raw tool activity into a short human status line + checklist. */
export function buildFriendlyProgress(options: {
  tools: AnalysisToolCall[];
  status: string | null;
  live: boolean;
  stopping?: boolean;
  kind?: AnalysisKind;
}): { headline: string; phases: FriendlyPhase[] } {
  const { tools, status, live, stopping, kind } = options;
  const labels = kind === "team-reports" ? TEAM_PHASE_LABEL : PHASE_LABEL;

  if (stopping || /stopp/i.test(status ?? "")) {
    return {
      headline: labels.stopping,
      phases: PHASE_ORDER.map((id) => ({
        id,
        label: labels[id],
        done: false,
        active: false,
      })),
    };
  }

  if (!live) {
    return {
      headline: "Finished",
      phases: PHASE_ORDER.map((id) => ({
        id,
        label: labels[id],
        done: true,
        active: false,
      })),
    };
  }

  // Progress only moves forward. Later sqlite/read tools must not yank the
  // headline back to "Reviewing your screen activity".
  let activeIndex = 0;

  for (const tool of tools) {
    const phase = classifyTool(tool);
    const index = PHASE_ORDER.indexOf(phase);
    if (index > activeIndex) activeIndex = index;
  }

  if (tools.length === 0) {
    activeIndex = 0;
  }

  const active = PHASE_ORDER[activeIndex] ?? "starting";

  return {
    headline: labels[active],
    phases: PHASE_ORDER.map((id, index) => ({
      id,
      label: labels[id],
      done: index < activeIndex,
      active: id === active,
    })),
  };
}
