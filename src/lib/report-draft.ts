import type { WorkReport } from "@/lib/reports";

/** Editable slice of a work report (everything shown on the page). */
export type ReportDraft = {
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
  kpis: WorkReport["kpis"];
  findings: WorkReport["findings"];
  timeAllocation: WorkReport["timeAllocation"];
  timeAllocationTakeaway: string;
  dailyMix: WorkReport["dailyMix"];
  dailyMixTakeaway: string;
  focusScore: WorkReport["focusScore"];
  focusTakeaway: string;
  whatTheyDid: string[];
  timeline: WorkReport["timeline"];
  learnings: WorkReport["learnings"];
  repetitiveWork: WorkReport["repetitiveWork"];
  bottlenecks: WorkReport["bottlenecks"];
  opportunities: WorkReport["opportunities"];
  improvements: string[];
  nextSteps: WorkReport["nextSteps"];
  scorecard: WorkReport["scorecard"];
};

export function toReportDraft(report: WorkReport): ReportDraft {
  return {
    title: report.title ?? "",
    subtitle: report.subtitle ?? "",
    period: report.period ?? "",
    person: report.person ?? "",
    role: report.role ?? "",
    generatedAt: report.generatedAt ?? "",
    headline: report.headline ?? "",
    executiveBrief: report.executiveBrief ?? "",
    keyInsight: report.keyInsight ?? "",
    deliveryUnlock: report.deliveryUnlock ?? "",
    impactOnce: report.impactOnce ?? "",
    kpis: structuredClone(report.kpis ?? []),
    findings: structuredClone(report.findings ?? []),
    timeAllocation: structuredClone(report.timeAllocation ?? []),
    timeAllocationTakeaway: report.timeAllocationTakeaway ?? "",
    dailyMix: structuredClone(report.dailyMix ?? []),
    dailyMixTakeaway: report.dailyMixTakeaway ?? "",
    focusScore: structuredClone(report.focusScore ?? []),
    focusTakeaway: report.focusTakeaway ?? "",
    whatTheyDid: [...(report.whatTheyDid ?? [])],
    timeline: structuredClone(report.timeline ?? []),
    learnings: structuredClone(report.learnings ?? []),
    repetitiveWork: structuredClone(report.repetitiveWork ?? []),
    bottlenecks: structuredClone(report.bottlenecks ?? []),
    opportunities: structuredClone(report.opportunities ?? []),
    improvements: [...(report.improvements ?? [])],
    nextSteps: structuredClone(report.nextSteps ?? []),
    scorecard: structuredClone(report.scorecard ?? []),
  };
}

export function applyReportDraft(
  report: WorkReport,
  draft: ReportDraft,
): WorkReport {
  return {
    ...report,
    title: draft.title.trim(),
    subtitle: draft.subtitle.trim(),
    period: draft.period.trim(),
    person: draft.person.trim(),
    role: draft.role.trim(),
    generatedAt: draft.generatedAt.trim(),
    headline: draft.headline.trim(),
    executiveBrief: draft.executiveBrief.trim(),
    keyInsight: draft.keyInsight.trim(),
    deliveryUnlock: draft.deliveryUnlock.trim(),
    impactOnce: draft.impactOnce.trim(),
    kpis: draft.kpis,
    findings: draft.findings,
    timeAllocation: draft.timeAllocation,
    timeAllocationTakeaway: draft.timeAllocationTakeaway.trim(),
    dailyMix: draft.dailyMix,
    dailyMixTakeaway: draft.dailyMixTakeaway.trim(),
    focusScore: draft.focusScore,
    focusTakeaway: draft.focusTakeaway.trim(),
    whatTheyDid: draft.whatTheyDid.map((s) => s.trim()).filter(Boolean),
    timeline: draft.timeline,
    learnings: draft.learnings,
    repetitiveWork: draft.repetitiveWork,
    bottlenecks: draft.bottlenecks,
    opportunities: draft.opportunities,
    improvements: draft.improvements.map((s) => s.trim()).filter(Boolean),
    nextSteps: draft.nextSteps,
    scorecard: draft.scorecard,
  };
}
