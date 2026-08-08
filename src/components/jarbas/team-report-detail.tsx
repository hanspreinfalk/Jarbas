import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft } from "lucide-react";
import {
  AnalysisItemToolbar,
  DeleteConfirmDialog,
  FieldInput,
  FieldLabel,
  TextArea,
} from "@/components/jarbas/analysis-item-editor";
import { AnalysisChatPanel } from "@/components/jarbas/analysis-chat-panel";
import { type DetailViewTab } from "@/components/jarbas/detail-ai-tabs";
import { DocumentMasthead } from "@/components/jarbas/document-masthead";
import { ReportCloudBanner } from "@/components/jarbas/report-cloud-banner";
import { ReportMarkdown } from "@/components/jarbas/report-markdown";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { AnalysisTranscript } from "@/lib/analysis";
import {
  formatGeneratedAt,
  formatGenerationDuration,
  formatRangeLabel,
} from "@/lib/date-range";
import { exportReportHtml } from "@/lib/export-report-html";
import {
  normalizeTeamWorkReport,
  type TeamWorkReport,
} from "@/lib/team-reports";
import { cn } from "@/lib/utils";

type IndexItem = {
  step: string;
  title: string;
  id: string;
};

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Section({
  step,
  title,
  id,
  children,
}: {
  step: string;
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-pdf-block
      className="mt-8 scroll-mt-6 border-t border-border pt-8 sm:mt-10 sm:scroll-mt-8 sm:pt-10"
    >
      <div className="mb-4 flex items-baseline gap-3 sm:mb-5">
        <span className="label-caps shrink-0 text-muted-foreground">{step}</span>
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function TeamReportIndex({ sections }: { sections: IndexItem[] }) {
  if (sections.length === 0) return null;
  return (
    <nav
      aria-label="Team report index"
      data-pdf-block
      className="mt-8 border border-border bg-card px-4 py-4 sm:px-5"
    >
      <p className="label-caps text-muted-foreground">Index</p>
      <ol className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {sections.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              data-export-href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                scrollToSection(item.id);
              }}
              className="group flex w-full items-baseline gap-2 py-1.5 text-left text-sm transition-colors hover:text-foreground"
            >
              <span className="label-caps shrink-0 text-[10px] text-muted-foreground group-hover:text-foreground/70">
                {item.step}
              </span>
              <span className="min-w-0 text-muted-foreground underline-offset-2 group-hover:text-foreground group-hover:underline">
                {item.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function buildTeamIndex(report: TeamWorkReport): IndexItem[] {
  const sections: IndexItem[] = [
    { step: "01", title: "Explanation", id: "team-report-01" },
    { step: "02", title: "People considered", id: "team-report-02" },
  ];
  if (report.kpis.length > 0) {
    sections.push({ step: "03", title: "Team snapshot", id: "team-report-03" });
  }
  if (report.memberSnapshots.length > 0) {
    sections.push({
      step: "04",
      title: "Member snapshots",
      id: "team-report-04",
    });
  }
  if (report.teamFindings.length > 0) {
    sections.push({
      step: "05",
      title: "Team findings",
      id: "team-report-05",
    });
  }
  if (report.sharedPatterns.length > 0) {
    sections.push({
      step: "06",
      title: "Shared patterns",
      id: "team-report-06",
    });
  }
  if (report.crossTeamBottlenecks.length > 0) {
    sections.push({
      step: "07",
      title: "Cross-team bottlenecks",
      id: "team-report-07",
    });
  }
  if (report.teamOpportunities.length > 0) {
    sections.push({
      step: "08",
      title: "Team opportunities",
      id: "team-report-08",
    });
  }
  if (report.scorecard.length > 0) {
    sections.push({ step: "09", title: "Scorecard", id: "team-report-09" });
  }
  if (report.nextSteps.length > 0) {
    sections.push({ step: "10", title: "Next steps", id: "team-report-10" });
  }
  return sections.map((item, index) => ({
    ...item,
    step: String(index + 1).padStart(2, "0"),
  }));
}

function stepFor(sections: IndexItem[], id: string) {
  return sections.find((item) => item.id === id)?.step ?? "";
}

function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="h-1.5 w-full bg-muted">
      <div className="h-full bg-primary" style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** Title-case person names for consistent report display. */
function displayPersonName(name: string) {
  const raw = name.trim();
  if (!raw) return "Teammate";
  return raw
    .split(/\s+/)
    .map((part) => {
      if (!part) return part;
      if (part === part.toUpperCase() && part.length <= 3) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function initialsFor(name: string) {
  return displayPersonName(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TeamReportDetail({
  report,
  onBack,
  onSaved,
  onDeleted,
  backLabel = "Back",
}: {
  report: TeamWorkReport;
  onBack: () => void;
  onSaved: (report: TeamWorkReport) => void;
  onDeleted: () => void;
  backLabel?: string;
}) {
  const updateReport = useMutation(api.reports.update);
  const removeReport = useMutation(api.reports.remove);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<DetailViewTab>("details");
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: report.title,
    subtitle: report.subtitle,
    period: report.period,
    headline: report.headline,
    executiveBrief: report.executiveBrief,
    keyInsight: report.keyInsight,
    deliveryUnlock: report.deliveryUnlock,
    impactOnce: report.impactOnce,
  });

  const analysis = report.analysis as AnalysisTranscript | undefined;
  const promptLabel = `Build a team report for ${formatRangeLabel(
    report.startDate ?? "",
    report.endDate ?? "",
  )}.`;

  useEffect(() => {
    setDraft({
      title: report.title,
      subtitle: report.subtitle,
      period: report.period,
      headline: report.headline,
      executiveBrief: report.executiveBrief,
      keyInsight: report.keyInsight,
      deliveryUnlock: report.deliveryUnlock,
      impactOnce: report.impactOnce,
    });
    setEditing(false);
    setTab("details");
    setActionError(null);
  }, [report]);

  const index = useMemo(() => buildTeamIndex(report), [report]);
  const people = report.memberSnapshots;
  const peopleCount = people.length;

  async function handleExportHtml() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    setActionError(null);
    try {
      await exportReportHtml(
        reportRef.current,
        `${report.title}-${report.period || "team-report"}`,
        report.title,
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      setActionError("Title is required.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const next = await updateReport({
        id: report.id as Id<"reports">,
        payload: {
          ...report,
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim(),
          period: draft.period.trim(),
          headline: draft.headline.trim(),
          executiveBrief: draft.executiveBrief.trim(),
          keyInsight: draft.keyInsight.trim(),
          deliveryUnlock: draft.deliveryUnlock.trim(),
          impactOnce: draft.impactOnce.trim(),
          scope: "team",
        },
      });
      onSaved(normalizeTeamWorkReport(next as Record<string, unknown>));
      setEditing(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      await removeReport({ id: report.id as Id<"reports"> });
      setConfirmDelete(false);
      onDeleted();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
      setDeleting(false);
    }
  }

  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:max-w-4xl lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 rounded-none text-muted-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <AnalysisItemToolbar
            editing={editing}
            saving={saving}
            deleting={deleting}
            exporting={exporting}
            tab={tab}
            onTabChange={setTab}
            onEdit={() => {
              setEditing(true);
              setActionError(null);
            }}
            onCancelEdit={() => {
              setEditing(false);
              setActionError(null);
            }}
            onSave={() => void handleSave()}
            onDeleteRequest={() => setConfirmDelete(true)}
            onExport={() => void handleExportHtml()}
          />
        </div>
      </div>

      {actionError ? (
        <p className="mt-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {tab === "ai" && !editing ? (
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
          <AnalysisChatPanel
            transcript={
              analysis ?? {
                jobId: report.jobId ?? report.id,
                kind: "team-reports",
                startDate: report.startDate,
                endDate: report.endDate,
                provider: report.provider,
                model: report.model,
                content: "",
                thinking: "",
                tools: [],
                startedAt: undefined,
                finishedAt: undefined,
                durationMs: report.generationDurationMs,
              }
            }
            promptLabel={promptLabel}
          />
        </div>
      ) : editing ? (
        <div className="mt-8 space-y-4 sm:mt-10">
          <ReportCloudBanner className="mb-2" />
          <div className="space-y-1.5">
            <FieldLabel>Title</FieldLabel>
            <FieldInput
              value={draft.title}
              onChange={(value) => setDraft((c) => ({ ...c, title: value }))}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Subtitle</FieldLabel>
            <FieldInput
              value={draft.subtitle}
              onChange={(value) => setDraft((c) => ({ ...c, subtitle: value }))}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Period</FieldLabel>
            <FieldInput
              value={draft.period}
              onChange={(value) => setDraft((c) => ({ ...c, period: value }))}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Headline</FieldLabel>
            <FieldInput
              value={draft.headline}
              onChange={(value) => setDraft((c) => ({ ...c, headline: value }))}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Executive brief (markdown)</FieldLabel>
            <TextArea
              value={draft.executiveBrief}
              onChange={(value) =>
                setDraft((c) => ({ ...c, executiveBrief: value }))
              }
              rows={10}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Key insight</FieldLabel>
            <TextArea
              value={draft.keyInsight}
              onChange={(value) =>
                setDraft((c) => ({ ...c, keyInsight: value }))
              }
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Delivery unlock</FieldLabel>
            <TextArea
              value={draft.deliveryUnlock}
              onChange={(value) =>
                setDraft((c) => ({ ...c, deliveryUnlock: value }))
              }
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Impact once unlocked</FieldLabel>
            <TextArea
              value={draft.impactOnce}
              onChange={(value) =>
                setDraft((c) => ({ ...c, impactOnce: value }))
              }
              rows={2}
            />
          </div>
        </div>
      ) : (
        <>
          <div ref={reportRef} className="pt-8 sm:pt-10">
            <DocumentMasthead
              kind="Team report"
              reference={report.period || "Team report"}
              chips={<ReportCloudBanner />}
              title={report.title}
              standfirst={report.headline || undefined}
              byline={
                <>
                  {peopleCount > 0 ? (
                    <p className="text-foreground">
                      {people
                        .map((member) => displayPersonName(member.person))
                        .join(" · ")}
                    </p>
                  ) : null}
                  {report.subtitle ? (
                    <p>{report.subtitle}</p>
                  ) : (
                    <p>Team report</p>
                  )}
                  {formatGeneratedAt(report.generatedAt) ? (
                    <p>
                      Generated {formatGeneratedAt(report.generatedAt)}
                      {formatGenerationDuration(report.generationDurationMs)
                        ? ` · took ${formatGenerationDuration(report.generationDurationMs)}`
                        : ""}
                    </p>
                  ) : null}
                </>
              }
            />

            <TeamReportIndex sections={index} />

            <Section
              step={stepFor(index, "team-report-01")}
              title="Explanation"
              id="team-report-01"
            >
              <div data-pdf-block>
                <ReportMarkdown
                  key={`${report.id}-brief`}
                  content={String(report.executiveBrief ?? "")}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2" data-pdf-block>
                {report.keyInsight ? (
                  <div className="border border-border bg-card px-3 py-3">
                    <p className="label-caps text-muted-foreground">
                      Key insight
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {report.keyInsight}
                    </p>
                  </div>
                ) : null}
                {report.deliveryUnlock ? (
                  <div className="border border-border bg-primary px-3 py-3 text-primary-foreground">
                    <p className="label-caps text-primary-foreground/70">
                      Delivery unlock
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed">
                      {report.deliveryUnlock}
                    </p>
                    {report.impactOnce ? (
                      <p className="mt-2 text-xs text-primary-foreground/80">
                        {report.impactOnce}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Section>

            <Section
              step={stepFor(index, "team-report-02")}
              title="People considered"
              id="team-report-02"
            >
              {peopleCount === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No member snapshots were attached to this team report.
                </p>
              ) : (
                <ul data-pdf-block className="divide-y divide-border border border-border bg-card">
                  {people.map((member) => (
                    <li
                      key={`scope-${member.person}-${member.clerkUserId}`}
                      className="flex items-start gap-3 px-4 py-4 sm:px-5"
                    >
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center border border-border bg-background text-xs font-semibold text-muted-foreground">
                        {initialsFor(member.person)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold tracking-tight text-foreground">
                          {displayPersonName(member.person)}
                        </p>
                        {member.role ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {member.role}
                          </p>
                        ) : null}
                        {member.headline ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {member.headline}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

          {report.kpis.length > 0 ? (
            <Section
              step={stepFor(index, "team-report-03")}
              title="Team snapshot"
              id="team-report-03"
            >
              <div
                data-pdf-block
                className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3"
              >
                {report.kpis.map((kpi) => (
                  <div
                    key={`${kpi.label}-${kpi.value}`}
                    className="bg-card px-3 py-3 sm:px-4"
                  >
                    <p className="label-caps text-[10px] text-muted-foreground sm:text-[11px]">
                      {kpi.label}
                    </p>
                    <p className="mt-1 font-display text-2xl tracking-tight text-foreground">
                      {kpi.value}
                    </p>
                    {kpi.delta ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {kpi.delta}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {report.memberSnapshots.length > 0 ? (
            <Section
              step={stepFor(index, "team-report-04")}
              title="Member snapshots"
              id="team-report-04"
            >
              <ul className="space-y-4">
                {report.memberSnapshots.map((member) => (
                  <li
                    key={`snap-${member.person}-${member.clerkUserId}`}
                    data-pdf-block
                    className="border border-border bg-card"
                  >
                    <div className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-5">
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center border border-border bg-background text-xs font-semibold tracking-wide text-muted-foreground">
                        {initialsFor(member.person)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold tracking-tight text-foreground">
                          {displayPersonName(member.person)}
                        </p>
                        {member.role ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {member.role}
                          </p>
                        ) : null}
                        {member.headline ? (
                          <p className="mt-2 text-sm leading-relaxed text-foreground">
                            {member.headline}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {(member.strengths.length > 0 ||
                      member.risks.length > 0) && (
                      <div className="grid gap-px border-b border-border bg-border sm:grid-cols-2">
                        <div className="bg-card px-4 py-4 sm:px-5">
                          <p className="label-caps text-muted-foreground">
                            Strengths
                          </p>
                          {member.strengths.length > 0 ? (
                            <ul className="mt-3 space-y-2">
                              {member.strengths.map((item) => (
                                <li
                                  key={`${member.person}-s-${item}`}
                                  className="flex gap-2 text-sm leading-relaxed text-foreground"
                                >
                                  <span
                                    aria-hidden
                                    className="mt-2 size-1 shrink-0 rounded-full bg-primary"
                                  />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-muted-foreground">
                              None noted.
                            </p>
                          )}
                        </div>
                        <div className="bg-card px-4 py-4 sm:px-5">
                          <p className="label-caps text-muted-foreground">
                            Risks
                          </p>
                          {member.risks.length > 0 ? (
                            <ul className="mt-3 space-y-2">
                              {member.risks.map((item) => (
                                <li
                                  key={`${member.person}-r-${item}`}
                                  className="flex gap-2 text-sm leading-relaxed text-foreground"
                                >
                                  <span
                                    aria-hidden
                                    className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50"
                                  />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-muted-foreground">
                              None noted.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {member.topOpportunity ? (
                      <div className="bg-muted/50 px-4 py-4 sm:px-5">
                        <p className="label-caps text-muted-foreground">
                          Top unlock
                        </p>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
                          {member.topOpportunity}
                        </p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {report.teamFindings.length > 0 ? (
            <Section
              step={stepFor(index, "team-report-05")}
              title="Team findings"
              id="team-report-05"
            >
              <ol className="space-y-3">
                {report.teamFindings.map((finding, findingIndex) => (
                  <li
                    key={finding.title}
                    data-pdf-block
                    className="border border-border bg-card"
                  >
                    <div className="flex gap-3 px-4 py-4 sm:px-5">
                      <span className="label-caps mt-0.5 shrink-0 text-[10px] text-muted-foreground">
                        {String(findingIndex + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold tracking-tight text-foreground">
                          {finding.title}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {finding.detail}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {report.sharedPatterns.length > 0 ? (
            <Section
              step={stepFor(index, "team-report-06")}
              title="Shared patterns"
              id="team-report-06"
            >
              <ul className="space-y-4">
                {report.sharedPatterns.map((pattern, patternIndex) => (
                  <li
                    key={pattern.title}
                    data-pdf-block
                    className="border border-border bg-card"
                  >
                    <div className="flex gap-3 border-b border-border px-4 py-4 sm:px-5">
                      <span className="label-caps mt-0.5 shrink-0 text-[10px] text-muted-foreground">
                        {String(patternIndex + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold tracking-tight text-foreground">
                          {pattern.title}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {pattern.detail}
                        </p>
                      </div>
                    </div>
                    {pattern.members.length > 0 ? (
                      <div className="bg-muted/50 px-4 py-3 sm:px-5">
                        <p className="label-caps text-muted-foreground">
                          Seen in
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {pattern.members.map((name) => (
                            <span
                              key={`${pattern.title}-${name}`}
                              className="border border-border bg-background px-2.5 py-1 text-sm text-foreground"
                            >
                              {displayPersonName(name)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {report.crossTeamBottlenecks.length > 0 ? (
            <Section
              step={stepFor(index, "team-report-07")}
              title="Cross-team bottlenecks"
              id="team-report-07"
            >
              <ul className="space-y-4">
                {report.crossTeamBottlenecks.map((item, itemIndex) => (
                  <li
                    key={item.title}
                    data-pdf-block
                    className="border border-border bg-card"
                  >
                    <div className="flex gap-3 border-b border-border px-4 py-4 sm:px-5">
                      <span className="label-caps mt-0.5 shrink-0 text-[10px] text-muted-foreground">
                        {String(itemIndex + 1).padStart(2, "0")}
                      </span>
                      <p className="min-w-0 flex-1 text-base font-semibold tracking-tight text-foreground">
                        {item.title}
                      </p>
                    </div>
                    {(item.cost || item.unlock) && (
                      <div className="grid gap-px border-b border-border bg-border sm:grid-cols-2">
                        <div className="bg-card px-4 py-4 sm:px-5">
                          <p className="label-caps text-muted-foreground">
                            Cost
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-foreground">
                            {item.cost || "Not quantified."}
                          </p>
                        </div>
                        <div className="bg-card px-4 py-4 sm:px-5">
                          <p className="label-caps text-muted-foreground">
                            Unlock
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-foreground">
                            {item.unlock || "Define the intervention."}
                          </p>
                        </div>
                      </div>
                    )}
                    {item.owners.length > 0 ? (
                      <div className="bg-muted/50 px-4 py-3 sm:px-5">
                        <p className="label-caps text-muted-foreground">
                          Owners
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.owners.map((name) => (
                            <span
                              key={`${item.title}-${name}`}
                              className="border border-border bg-background px-2.5 py-1 text-sm text-foreground"
                            >
                              {displayPersonName(name)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {report.teamOpportunities.length > 0 ? (
            <Section
              step={stepFor(index, "team-report-08")}
              title="Team opportunities"
              id="team-report-08"
            >
              <ul className="space-y-4">
                {report.teamOpportunities.map((item, itemIndex) => (
                  <li
                    key={item.name}
                    data-pdf-block
                    className="border border-border bg-card"
                  >
                    <div
                      data-export-stack
                      className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:px-5 md:flex-row md:items-start md:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 gap-3 md:min-w-[16rem]">
                        <span className="label-caps mt-0.5 shrink-0 text-[10px] text-muted-foreground">
                          {String(itemIndex + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold tracking-tight text-foreground">
                            {item.name}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {item.unlock}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pl-7 md:pl-0">
                        <span className="border border-border bg-background px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
                          Impact {item.impact}
                        </span>
                        <span className="border border-border bg-background px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
                          Effort {item.effort}
                        </span>
                        {item.horizon ? (
                          <span className="border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                            {item.horizon}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="bg-muted/50 px-4 py-3 sm:px-5">
                      <p className="label-caps text-muted-foreground">
                        From pattern
                      </p>
                      <p className="mt-1.5 text-sm text-foreground">
                        {item.fromPattern || "Shared pattern"}
                        {item.owners.length
                          ? ` · ${item.owners.map(displayPersonName).join(", ")}`
                          : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {report.scorecard.length > 0 ? (
            <Section
              step={stepFor(index, "team-report-09")}
              title="Scorecard"
              id="team-report-09"
            >
              <ul className="space-y-4">
                {report.scorecard.map((item) => (
                  <li key={item.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {item.score}
                      </p>
                    </div>
                    <div className="mt-2">
                      <ScoreBar score={item.score} />
                    </div>
                    {item.note ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {item.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {report.nextSteps.length > 0 ? (
            <Section
              step={stepFor(index, "team-report-10")}
              title="Next steps"
              id="team-report-10"
            >
              <ol className="space-y-2">
                {report.nextSteps.map((step, indexValue) => (
                  <li
                    key={`${step.action}-${step.owner}-${indexValue}`}
                    data-pdf-block
                    className={cn(
                      "flex gap-3 border border-border bg-card px-4 py-3 text-sm text-foreground",
                    )}
                  >
                    <span className="label-caps shrink-0 text-[10px] text-muted-foreground">
                      {String(indexValue + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{step.action}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {step.owner}
                        {step.when ? ` · ${step.when}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}
          </div>
        </>
      )}

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete team report?"
        description="This permanently deletes the team report. You cannot undo this."
        deleting={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
