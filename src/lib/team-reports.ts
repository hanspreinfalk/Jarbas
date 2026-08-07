import type { AnalysisTranscript } from "@/lib/analysis";

export type TeamMemberSnapshot = {
  clerkUserId?: string;
  person: string;
  role: string;
  headline: string;
  strengths: string[];
  risks: string[];
  topOpportunity: string;
};

export type TeamWorkReport = {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  generatedAt: string;
  /** Always team for this shape. */
  scope: "team";
  headline: string;
  executiveBrief: string;
  keyInsight: string;
  deliveryUnlock: string;
  impactOnce: string;
  kpis: {
    label: string;
    value: string;
    delta: string;
    tone: "up" | "flat" | "watch";
  }[];
  teamFindings: {
    title: string;
    detail: string;
  }[];
  memberSnapshots: TeamMemberSnapshot[];
  sharedPatterns: {
    title: string;
    detail: string;
    members: string[];
  }[];
  crossTeamBottlenecks: {
    title: string;
    cost: string;
    unlock: string;
    owners: string[];
  }[];
  teamOpportunities: {
    name: string;
    unlock: string;
    fromPattern: string;
    impact: number;
    effort: number;
    horizon: string;
    owners: string[];
  }[];
  nextSteps: {
    action: string;
    owner: string;
    when: string;
  }[];
  scorecard: {
    label: string;
    score: number;
    note: string;
  }[];
  createdAt?: string;
  startDate?: string;
  endDate?: string;
  provider?: string;
  model?: string;
  jobId?: string;
  selectedClerkUserIds?: string[];
  memberReportIds?: string[];
  analysis?: AnalysisTranscript;
  _convex?: {
    organizationId: string;
    clerkUserId: string;
    createdByClerkUserId: string;
    scope: "member" | "team";
  };
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

export function isTeamWorkReport(raw: unknown): raw is TeamWorkReport {
  if (!raw || typeof raw !== "object") return false;
  const row = raw as Record<string, unknown>;
  const scope =
    row.scope ??
    (row._convex as { scope?: string } | undefined)?.scope;
  if (scope === "team") return true;
  return Array.isArray(row.memberSnapshots) || Array.isArray(row.teamFindings);
}

/** Normalize partial AI / Convex team report payload. */
export function normalizeTeamWorkReport(raw: Partial<TeamWorkReport> & Record<string, unknown>): TeamWorkReport {
  const memberSnapshots = Array.isArray(raw.memberSnapshots)
    ? raw.memberSnapshots.map((item) => {
        const row = (item ?? {}) as Partial<TeamMemberSnapshot>;
        return {
          clerkUserId: row.clerkUserId || "",
          person: row.person || "Teammate",
          role: row.role || "",
          headline: row.headline || "",
          strengths: asStringArray(row.strengths),
          risks: asStringArray(row.risks),
          topOpportunity: row.topOpportunity || "",
        };
      })
    : [];

  const teamOpportunities = Array.isArray(raw.teamOpportunities)
    ? raw.teamOpportunities.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          name: String(row.name ?? ""),
          unlock: String(row.unlock ?? ""),
          fromPattern: String(row.fromPattern ?? ""),
          impact: typeof row.impact === "number" ? row.impact : 0,
          effort: typeof row.effort === "number" ? row.effort : 1,
          horizon: String(row.horizon ?? ""),
          owners: asStringArray(row.owners),
        };
      })
    : [];

  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "Team report"),
    subtitle: String(raw.subtitle ?? "Multi-person synthesis"),
    period: String(raw.period ?? ""),
    generatedAt: String(raw.generatedAt ?? raw.createdAt ?? ""),
    scope: "team",
    headline: String(raw.headline ?? ""),
    executiveBrief: String(raw.executiveBrief ?? ""),
    keyInsight: String(raw.keyInsight ?? ""),
    deliveryUnlock: String(raw.deliveryUnlock ?? ""),
    impactOnce: String(raw.impactOnce ?? ""),
    kpis: Array.isArray(raw.kpis) ? (raw.kpis as TeamWorkReport["kpis"]) : [],
    teamFindings: Array.isArray(raw.teamFindings)
      ? (raw.teamFindings as TeamWorkReport["teamFindings"])
      : Array.isArray(raw.findings)
        ? (raw.findings as TeamWorkReport["teamFindings"])
        : [],
    memberSnapshots,
    sharedPatterns: Array.isArray(raw.sharedPatterns)
      ? (raw.sharedPatterns as TeamWorkReport["sharedPatterns"]).map((item) => ({
          title: item.title || "",
          detail: item.detail || "",
          members: asStringArray(item.members),
        }))
      : [],
    crossTeamBottlenecks: Array.isArray(raw.crossTeamBottlenecks)
      ? (raw.crossTeamBottlenecks as TeamWorkReport["crossTeamBottlenecks"]).map(
          (item) => ({
            title: item.title || "",
            cost: item.cost || "",
            unlock: item.unlock || "",
            owners: asStringArray(item.owners),
          }),
        )
      : [],
    teamOpportunities,
    nextSteps: Array.isArray(raw.nextSteps)
      ? (raw.nextSteps as TeamWorkReport["nextSteps"])
      : [],
    scorecard: Array.isArray(raw.scorecard)
      ? (raw.scorecard as TeamWorkReport["scorecard"])
      : [],
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    startDate: raw.startDate ? String(raw.startDate) : undefined,
    endDate: raw.endDate ? String(raw.endDate) : undefined,
    provider: raw.provider ? String(raw.provider) : undefined,
    model: raw.model ? String(raw.model) : undefined,
    jobId: raw.jobId ? String(raw.jobId) : undefined,
    selectedClerkUserIds: asStringArray(raw.selectedClerkUserIds),
    memberReportIds: asStringArray(raw.memberReportIds),
    analysis: raw.analysis,
    _convex: raw._convex as TeamWorkReport["_convex"],
  };
}
