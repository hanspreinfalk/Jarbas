export type WorkReportLearning = {
  title: string;
  observed: string;
  insight: string;
  apps?: string[];
};

export type WorkReportOpportunity = {
  name: string;
  unlock: string;
  fromLearning: string;
  impact: number;
  effort: number;
  horizon: string;
  automationIdea?: string;
};

export type WorkReport = {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  person: string;
  role: string;
  generatedAt: string;
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
  findings: {
    title: string;
    detail: string;
  }[];
  timeAllocation: {
    name: string;
    hours: number;
    fill: string;
  }[];
  timeAllocationTakeaway: string;
  dailyMix: {
    day: string;
    deepWork: number;
    collaboration: number;
    admin: number;
  }[];
  dailyMixTakeaway: string;
  focusScore: {
    day: string;
    score: number;
  }[];
  focusTakeaway: string;
  whatTheyDid: string[];
  timeline: {
    time: string;
    activity: string;
    type: "deep" | "collab" | "admin";
  }[];
  learnings: WorkReportLearning[];
  repetitiveWork: {
    activity: string;
    occurrences: number;
    minutesEach: number;
    automatable: boolean;
  }[];
  bottlenecks: {
    title: string;
    cost: string;
    unlock: string;
  }[];
  opportunities: WorkReportOpportunity[];
  improvements: string[];
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
  analysis?: import("@/lib/analysis").AnalysisTranscript;
};

/** Normalize partial AI output so report charts do not crash. */
export function normalizeWorkReport(raw: WorkReport): WorkReport {
  const opportunities = Array.isArray(raw.opportunities)
    ? raw.opportunities.map((item) => ({
        name: item.name || "",
        unlock: item.unlock || "",
        fromLearning: item.fromLearning || "",
        impact: typeof item.impact === "number" ? item.impact : 0,
        effort: typeof item.effort === "number" ? item.effort : 1,
        horizon: item.horizon || "",
        automationIdea: item.automationIdea || "",
      }))
    : [];

  const learnings = Array.isArray(raw.learnings)
    ? raw.learnings.map((item) => ({
        title: item.title || "",
        observed: item.observed || "",
        insight: item.insight || "",
        apps: Array.isArray(item.apps) ? item.apps : [],
      }))
    : [];

  return {
    ...raw,
    title: raw.title || "Work report",
    subtitle: raw.subtitle || "Full package from captured activity",
    period: raw.period || "",
    person: raw.person || "You",
    role: raw.role || "",
    generatedAt: raw.generatedAt || raw.createdAt || "",
    headline: raw.headline || "",
    executiveBrief: raw.executiveBrief || "",
    keyInsight: raw.keyInsight || "",
    deliveryUnlock: raw.deliveryUnlock || "",
    impactOnce: raw.impactOnce || "",
    kpis: Array.isArray(raw.kpis) ? raw.kpis : [],
    findings: Array.isArray(raw.findings) ? raw.findings : [],
    timeAllocation: Array.isArray(raw.timeAllocation) ? raw.timeAllocation : [],
    timeAllocationTakeaway: raw.timeAllocationTakeaway || "",
    dailyMix: Array.isArray(raw.dailyMix) ? raw.dailyMix : [],
    dailyMixTakeaway: raw.dailyMixTakeaway || "",
    focusScore: Array.isArray(raw.focusScore) ? raw.focusScore : [],
    focusTakeaway: raw.focusTakeaway || "",
    whatTheyDid: Array.isArray(raw.whatTheyDid) ? raw.whatTheyDid : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    learnings,
    repetitiveWork: Array.isArray(raw.repetitiveWork) ? raw.repetitiveWork : [],
    bottlenecks: Array.isArray(raw.bottlenecks) ? raw.bottlenecks : [],
    opportunities,
    improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
    nextSteps: Array.isArray(raw.nextSteps) ? raw.nextSteps : [],
    scorecard: Array.isArray(raw.scorecard) ? raw.scorecard : [],
    analysis: raw.analysis,
    jobId: raw.jobId,
    startDate: raw.startDate,
    endDate: raw.endDate,
  };
}
