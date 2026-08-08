import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  FileBarChart,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyzeRangeDialog } from "@/components/jarbas/analyze-range-dialog";
import { AnalysisChatPanel } from "@/components/jarbas/analysis-chat-panel";
import {
  AnalysisItemToolbar,
  DeleteConfirmDialog,
} from "@/components/jarbas/analysis-item-editor";
import { useAnalysisRun } from "@/components/jarbas/analysis-run-provider";
import { AnalysisRunView } from "@/components/jarbas/analysis-run-view";
import { DocumentMasthead } from "@/components/jarbas/document-masthead";
import { ReportCloudBanner } from "@/components/jarbas/report-cloud-banner";
import { ReportDraftEditors } from "@/components/jarbas/report-draft-editors";
import { PeriodBadge } from "@/components/jarbas/period-badge";
import { ReportMarkdown } from "@/components/jarbas/report-markdown";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { AnalysisTranscript } from "@/lib/analysis";
import { formatGeneratedAt, formatGenerationDuration, formatRangeLabel } from "@/lib/date-range";
import { exportReportHtml } from "@/lib/export-report-html";
import {
  applyReportDraft,
  toReportDraft,
  type ReportDraft,
} from "@/lib/report-draft";
import { normalizeWorkReport, type WorkReport } from "@/lib/reports";
import { cn } from "@/lib/utils";

const mixConfig = {
  deepWork: { label: "Deep work", color: "#080870" },
  collaboration: { label: "Collaboration", color: "#bce2ff" },
  admin: { label: "Admin / setup", color: "#c5c0b4" },
} satisfies ChartConfig;

const focusConfig = {
  score: { label: "Focus index", color: "#080870" },
} satisfies ChartConfig;

const repeatConfig = {
  totalMinutes: { label: "Minutes / week", color: "#080870" },
} satisfies ChartConfig;

const REPORT_SECTIONS = [
  { step: "01", title: "Explanation", id: "report-section-01" },
  { step: "02", title: "Week snapshot", id: "report-section-02" },
  { step: "03", title: "Where time went", id: "report-section-03" },
  { step: "04", title: "Daily cadence", id: "report-section-04" },
  { step: "05", title: "What they did", id: "report-section-05" },
  { step: "06", title: "Timeline", id: "report-section-06" },
  { step: "07", title: "Insights · how they work", id: "report-section-07" },
  {
    step: "08",
    title: "Opportunities · unlocks from insights",
    id: "report-section-08",
  },
  { step: "09", title: "Repetitive work", id: "report-section-09" },
  { step: "10", title: "Bottlenecks", id: "report-section-10" },
  { step: "11", title: "How they can improve", id: "report-section-11" },
  { step: "12", title: "Next steps", id: "report-section-12" },
] as const;

function scrollToReportSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ReportIndex() {
  return (
    <nav
      aria-label="Report index"
      className="mt-8 border border-border bg-card px-4 py-4 sm:px-5"
    >
      <p className="label-caps text-muted-foreground">Index</p>
      <ol className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {REPORT_SECTIONS.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              data-export-href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                scrollToReportSection(item.id);
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
    <section id={id} data-pdf-block className="mt-8 scroll-mt-6 border-t border-border pt-8 sm:mt-10 sm:scroll-mt-8 sm:pt-10">
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

function Takeaway({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">Takeaway · </span>
      {children}
    </p>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="h-1.5 w-full bg-muted">
      <div className="h-full bg-primary" style={{ width: `${score}%` }} />
    </div>
  );
}

function ReportDetail({
  report,
  onBack,
  onSaved,
  onDeleted,
  readOnly = false,
  backLabel = "All reports",
}: {
  report: WorkReport;
  onBack: () => void;
  onSaved: (report: WorkReport) => void;
  onDeleted: () => void;
  readOnly?: boolean;
  backLabel?: string;
}) {
  const updateReport = useMutation(api.reports.update);
  const removeReport = useMutation(api.reports.remove);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<"details" | "ai">("details");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReportDraft>(() => toReportDraft(report));
  const analysis = report.analysis as AnalysisTranscript | undefined;
  const promptLabel = `Generate a full report for ${formatRangeLabel(
    report.startDate ?? "",
    report.endDate ?? "",
  )}.`;

  useEffect(() => {
    setDraft(toReportDraft(report));
    setEditing(false);
    setActionError(null);
  }, [report]);

  const repeatChart = useMemo(
    () =>
      report.repetitiveWork.map((item) => ({
        name: item.activity,
        short:
          item.activity.length > 22
            ? `${item.activity.slice(0, 20)}...`
            : item.activity,
        totalMinutes: item.occurrences * item.minutesEach,
        automatable: item.automatable,
      })),
    [report.repetitiveWork],
  );

  const pieData = report.timeAllocation.map((item) => ({
    name: item.name,
    value: item.hours,
    fill: item.fill,
  }));

  async function handleExport() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      await exportReportHtml(
        reportRef.current,
        `${report.title}-${report.period}`,
        report.title,
      );
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
      const payload = applyReportDraft(report, draft);
      const next = await updateReport({
        id: report.id as Id<"reports">,
        payload,
      });
      onSaved(normalizeWorkReport(next as unknown as WorkReport));
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
            onTabChange={!readOnly ? setTab : undefined}
            showAnalysisRun={!readOnly}
            showEdit={!readOnly}
            showDelete={!readOnly}
            onEdit={() => {
              setDraft(toReportDraft(report));
              setEditing(true);
              setActionError(null);
            }}
            onCancelEdit={() => {
              setDraft(toReportDraft(report));
              setEditing(false);
              setActionError(null);
            }}
            onSave={() => void handleSave()}
            onDeleteRequest={() => setConfirmDelete(true)}
            onExport={() => void handleExport()}
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
                content: "",
                thinking: "",
                tools: [],
              }
            }
            promptLabel={promptLabel}
          />
        </div>
      ) : editing ? (
        <div className="pt-8 sm:pt-10">
          <ReportCloudBanner className="mb-6" />
          <ReportDraftEditors draft={draft} setDraft={setDraft} />
        </div>
      ) : (
      <>
      <div ref={reportRef} className="pt-8 sm:pt-10">
      <DocumentMasthead
        kind="Work report"
        reference={report.period}
        chips={<ReportCloudBanner />}
        title={report.title}
        standfirst={report.headline}
        byline={
          <>
            <p className="text-foreground">{report.person}</p>
            {report.role ? <p>{report.role}</p> : null}
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

      <ReportIndex />

      {/* 01 Summary */}
      <Section step="01" title="Explanation" id="report-section-01">
          <>
            <ReportMarkdown
              key={`${report.id}-brief`}
              content={String(report.executiveBrief ?? "")}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="border border-border bg-card px-3 py-3">
                <p className="label-caps text-muted-foreground">Key insight</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {report.keyInsight}
                </p>
              </div>
              <div className="border border-border bg-primary px-3 py-3 text-primary-foreground">
                <p className="label-caps text-primary-foreground/70">
                  Delivery unlock
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed">
                  {report.deliveryUnlock}
                </p>
                <p className="mt-2 text-xs text-primary-foreground/80">
                  {report.impactOnce}
                </p>
              </div>
            </div>
          </>
      </Section>

      {/* 02 Snapshot */}
      <Section step="02" title="Week snapshot" id="report-section-02">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          {report.kpis.map((kpi) => (
            <div key={kpi.label} className="bg-card px-3 py-3 sm:px-4">
              <p className="label-caps text-[10px] text-muted-foreground sm:text-[11px]">
                {kpi.label}
              </p>
              <p className="mt-1 font-display text-xl tracking-tight text-foreground sm:text-2xl">
                {kpi.value}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                {kpi.delta}
              </p>
            </div>
          ))}
        </div>
        <ol className="mt-4 space-y-3">
          {report.findings.map((finding, i) => (
            <li key={finding.title} className="flex gap-3 text-sm">
              <span className="label-caps mt-0.5 shrink-0 text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-medium text-foreground">{finding.title}</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {finding.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* 03 Time */}
      <Section step="03" title="Where time went" id="report-section-03">
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <ChartContainer
            config={{ value: { label: "Hours", color: "#080870" } }}
            className="mx-auto aspect-square w-full max-w-[220px] sm:max-w-[260px]"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={78}
                strokeWidth={2}
                stroke="var(--background)"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="space-y-2.5">
            {report.timeAllocation.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0"
                    style={{ background: item.fill }}
                  />
                  <span className="truncate text-foreground">{item.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {item.hours.toFixed(1)}h
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Takeaway>{report.timeAllocationTakeaway}</Takeaway>
      </Section>

      {/* 04 Cadence */}
      <Section step="04" title="Daily cadence" id="report-section-04">
        <ChartContainer
          config={mixConfig}
          className="aspect-[4/3] w-full sm:aspect-[16/9]"
        >
          <BarChart data={report.dailyMix} barGap={2}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} unit="h" width={28} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="deepWork" stackId="a" fill="var(--color-deepWork)" />
            <Bar
              dataKey="collaboration"
              stackId="a"
              fill="var(--color-collaboration)"
            />
            <Bar dataKey="admin" stackId="a" fill="var(--color-admin)" />
          </BarChart>
        </ChartContainer>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {Object.entries(mixConfig).map(([key, cfg]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="size-2.5" style={{ background: cfg.color }} />
              {cfg.label}
            </span>
          ))}
        </div>
        <Takeaway>{report.dailyMixTakeaway}</Takeaway>

        <div className="mt-6">
          <p className="mb-3 text-sm font-medium text-foreground">Focus index</p>
          <ChartContainer
            config={focusConfig}
            className="aspect-[16/10] w-full sm:aspect-[21/9]"
          >
            <AreaChart data={report.focusScore}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="var(--color-score)"
                fill="var(--color-score)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
          <Takeaway>{report.focusTakeaway}</Takeaway>
        </div>
      </Section>

      {/* 05 What they did + timeline */}
      <Section step="05" title="What they did" id="report-section-05">
        <ul className="space-y-2.5">
          {report.whatTheyDid.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-2 size-1 shrink-0 bg-foreground/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 06 Timeline */}
      <Section step="06" title="Timeline" id="report-section-06">
        <ol className="space-y-3 border-l border-border pl-4">
          {report.timeline.map((item) => (
            <li key={`${item.time}-${item.activity}`}>
              <p className="text-xs font-medium text-muted-foreground">
                {item.time}
              </p>
              <p className="mt-0.5 text-sm text-foreground">{item.activity}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 07 Insights */}
      <Section step="07" title="Insights · how they work" id="report-section-07">
        {report.learnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No insights captured for this period yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {report.learnings.map((item, i) => (
              <li
                key={`${item.title}-${i}`}
                className="border border-border px-3 py-3 sm:px-4"
              >
                <p className="text-sm font-semibold text-foreground">
                  <span className="text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}.{" "}
                  </span>
                  {item.title}
                </p>
                {item.observed ? (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                    <span className="font-medium">Observed · </span>
                    {item.observed}
                  </p>
                ) : null}
                {item.insight ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Insight · </span>
                    {item.insight}
                  </p>
                ) : null}
                {item.apps && item.apps.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Apps · {item.apps.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 08 Opportunities */}
      <Section
        step="08"
        title="Opportunities · unlocks from insights"
        id="report-section-08"
      >
        {report.opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No opportunities derived for this period yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {[...report.opportunities]
              .sort(
                (a, b) =>
                  b.impact / Math.max(b.effort, 1) -
                  a.impact / Math.max(a.effort, 1),
              )
              .map((item, i) => (
                <li
                  key={`${item.name}-${i}`}
                  className="border border-border px-3 py-3 sm:px-4"
                >
                  <div
                    data-export-stack
                    className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"
                  >
                    <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                      <span className="text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}.{" "}
                      </span>
                      {item.name}
                    </p>
                    <span className="label-caps w-fit shrink-0 border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                      {item.horizon}
                    </span>
                  </div>
                  {item.unlock ? (
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                      <span className="font-medium">Unlock · </span>
                      {item.unlock}
                    </p>
                  ) : null}
                  {item.fromLearning ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">
                        From insight ·{" "}
                      </span>
                      {item.fromLearning}
                    </p>
                  ) : null}
                  {item.automationIdea ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Automation idea ·{" "}
                      </span>
                      {item.automationIdea}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Impact {item.impact} · Effort {item.effort}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </Section>

      {/* 09 Repetition */}
      <Section step="09" title="Repetitive work" id="report-section-09">
        <ChartContainer
          config={repeatConfig}
          className="aspect-[4/3] w-full sm:aspect-[16/9]"
        >
          <BarChart
            data={repeatChart}
            layout="vertical"
            margin={{ left: 4, right: 8 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="short"
              tickLine={false}
              axisLine={false}
              width={96}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | (typeof repeatChart)[number]
                      | undefined;
                    return row?.name ?? "";
                  }}
                />
              }
            />
            <Bar dataKey="totalMinutes" radius={0}>
              {repeatChart.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.automatable ? "#080870" : "#8aa4c8"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <ul className="mt-4 divide-y divide-border border border-border">
          {report.repetitiveWork.map((item) => (
            <li key={item.activity} className="px-3 py-3">
              <p className="text-sm text-foreground">{item.activity}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {item.occurrences}× · {item.minutesEach}m ·{" "}
                  <span className="font-medium text-foreground">
                    {item.occurrences * item.minutesEach}m total
                  </span>
                </span>
                <span
                  className={cn(
                    "border px-1.5 py-0.5 label-caps text-[10px]",
                    item.automatable
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {item.automatable ? "Automatable" : "Human judgment"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* 10 Bottlenecks */}
      <Section step="10" title="Bottlenecks" id="report-section-10">
        <ul className="space-y-3">
          {report.bottlenecks.map((item, i) => (
            <li key={item.title} className="border border-border px-3 py-3 sm:px-4">
              <p className="text-sm font-semibold text-foreground">
                <span className="text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}.{" "}
                </span>
                {item.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{item.cost}</p>
              <p className="mt-2 text-sm text-foreground">
                <span className="font-medium">Unlock · </span>
                {item.unlock}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 11 Scorecard + improve */}
      <Section step="11" title="How they can improve" id="report-section-11">
        <ul className="mb-6 space-y-4">
          {report.scorecard.map((item) => (
            <li key={item.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  {item.label}
                </span>
                <span className="font-display text-lg tabular-nums text-foreground">
                  {item.score}
                </span>
              </div>
              <ScoreBar score={item.score} />
              <p className="mt-1.5 text-xs text-muted-foreground">{item.note}</p>
            </li>
          ))}
        </ul>
        <ul className="space-y-2.5 border-t border-border pt-4">
          {report.improvements.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-2 size-1 shrink-0 bg-foreground/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* 12 Next steps */}
      <Section step="12" title="Next steps" id="report-section-12">
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2.5 label-caps font-medium text-muted-foreground">
                  Action
                </th>
                <th className="px-3 py-2.5 label-caps font-medium text-muted-foreground">
                  Owner
                </th>
                <th className="px-3 py-2.5 label-caps font-medium text-muted-foreground">
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {report.nextSteps.map((step) => (
                <tr
                  key={step.action}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-3 text-foreground">{step.action}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                    {step.owner}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap font-medium text-foreground">
                    {step.when}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      </div>
      </>
      )}

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete report?"
        description="This permanently deletes the report. You cannot undo this."
        deleting={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export function ReportDetailView({
  report,
  onBack,
  onSaved,
  onDeleted,
  readOnly = false,
  backLabel = "All reports",
}: {
  report: WorkReport;
  onBack: () => void;
  onSaved?: (report: WorkReport) => void;
  onDeleted?: () => void;
  readOnly?: boolean;
  backLabel?: string;
}) {
  return (
    <ReportDetail
      report={report}
      onBack={onBack}
      onSaved={onSaved ?? (() => undefined)}
      onDeleted={onDeleted ?? (() => undefined)}
      readOnly={readOnly}
      backLabel={backLabel}
    />
  );
}

export function ReportsPage() {
  const { orgId } = useAuth();
  const createReport = useMutation(api.reports.create);
  const cloudReports = useQuery(
    api.reports.listMine,
    orgId ? { organizationId: orgId } : "skip",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const { meta, startRun, clearRun } = useAnalysisRun();

  const reports = useMemo(
    () =>
      (cloudReports ?? []).map((row) =>
        normalizeWorkReport(row as unknown as WorkReport),
      ),
    [cloudReports],
  );
  const loading = Boolean(orgId) && cloudReports === undefined;

  if (meta?.kind === "reports") {
    return (
      <AnalysisRunView
        onErrorBack={() => clearRun()}
        onCompleted={({ items }) => {
          void (async () => {
            if (savingRef.current) return;
            savingRef.current = true;
            try {
              setSaveError(null);
              if (!orgId) {
                throw new Error("Select an organization before saving a report.");
              }
              const payload = items?.[0];
              if (!payload || typeof payload !== "object") {
                throw new Error("Analysis finished but no report payload was returned.");
              }
              const saved = await createReport({
                organizationId: orgId,
                payload,
              });
              clearRun();
              setSelectedId(String(saved.id));
            } catch (error) {
              console.error("Failed to save report to Convex", error);
              setSaveError(
                error instanceof Error ? error.message : String(error),
              );
              clearRun();
            } finally {
              savingRef.current = false;
            }
          })();
        }}
      />
    );
  }

  const selected = reports.find((report) => report.id === selectedId);

  if (selected) {
    return (
      <ReportDetail
        report={selected}
        onBack={() => setSelectedId(null)}
        onSaved={() => {
          // Convex query will refresh; keep selection.
        }}
        onDeleted={() => {
          setSelectedId(null);
        }}
      />
    );
  }

  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="min-w-0">
        <p className="label-caps text-muted-foreground">Jarbas</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Reports
          </h1>
          <Button
            type="button"
            className="shrink-0 rounded-none self-start sm:self-auto"
            disabled={!orgId}
            onClick={() => setOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Generate full report
          </Button>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          The full package for a period: timeline, explanation, insights, and
          opportunities. Saved to your organization in the cloud.
        </p>
      </div>

      {!orgId ? (
        <p className="mt-8 border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Select an organization to view and save reports.
        </p>
      ) : null}

      {saveError ? (
        <p className="mt-8 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="mt-10 border border-border bg-card px-5 py-10 text-center">
          <p className="font-display text-xl tracking-tight text-foreground">
            No reports yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Choose a date range to build a complete report - what happened, how
            you work, and what to unlock next.
          </p>
          <Button
            type="button"
            className="mt-6 rounded-none"
            disabled={!orgId}
            onClick={() => setOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Generate full report
          </Button>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-border border border-border bg-card">
          {reports.map((report, index) => (
            <li key={report.id}>
              <button
                type="button"
                onClick={() => setSelectedId(report.id)}
                className={cn(
                  "flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-muted sm:px-5",
                  "animate-rise",
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground">
                  <FileBarChart className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-sm font-semibold tracking-tight text-foreground">
                      {report.title}
                    </span>
                    <PeriodBadge
                      period={report.period}
                      startDate={report.startDate}
                      endDate={report.endDate}
                      timeline={report.timeline}
                    />
                  </span>
                  {formatGeneratedAt(report.generatedAt) ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Generated {formatGeneratedAt(report.generatedAt)}
                      {report.person ? ` · ${report.person}` : ""}
                    </span>
                  ) : report.person ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {report.person}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnalyzeRangeDialog
        open={open}
        onOpenChange={setOpen}
        kind="reports"
        title="Generate full report"
        description="Pick a range. Jarbas builds the full report for that period."
        confirmLabel="Generate full report"
        onStarted={startRun}
      />
    </div>
  );
}
