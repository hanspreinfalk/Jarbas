import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Loader2,
  LoaderCircle,
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
  FieldInput,
  FieldLabel,
  TextArea,
  linesToList,
  listToLines,
} from "@/components/jarbas/analysis-item-editor";
import { AnalysisRunView } from "@/components/jarbas/analysis-run-view";
import { AnalysisRunButton } from "@/components/jarbas/detail-ai-tabs";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  deleteAnalysisItem,
  listAnalysisItems,
  updateAnalysisItem,
  type AnalysisRunMeta,
  type AnalysisTranscript,
} from "@/lib/analysis";
import { formatRangeLabel } from "@/lib/date-range";
import { exportReportPdf } from "@/lib/export-report-pdf";
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

function Section({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-border pt-8 sm:mt-10 sm:pt-10">
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
}: {
  report: WorkReport;
  onBack: () => void;
  onSaved: (report: WorkReport) => void;
  onDeleted: () => void;
}) {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<"details" | "ai">("details");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: report.title ?? "",
    subtitle: report.subtitle ?? "",
    period: report.period ?? "",
    person: report.person ?? "",
    role: report.role ?? "",
    headline: report.headline ?? "",
    executiveBrief: report.executiveBrief ?? "",
    keyInsight: report.keyInsight ?? "",
    deliveryUnlock: report.deliveryUnlock ?? "",
    impactOnce: report.impactOnce ?? "",
    improvements: listToLines(report.improvements),
  });
  const analysis = report.analysis as AnalysisTranscript | undefined;
  const promptLabel = `Capture a work report for ${formatRangeLabel(
    report.startDate ?? "",
    report.endDate ?? "",
  )}.`;

  useEffect(() => {
    setDraft({
      title: report.title ?? "",
      subtitle: report.subtitle ?? "",
      period: report.period ?? "",
      person: report.person ?? "",
      role: report.role ?? "",
      headline: report.headline ?? "",
      executiveBrief: report.executiveBrief ?? "",
      keyInsight: report.keyInsight ?? "",
      deliveryUnlock: report.deliveryUnlock ?? "",
      impactOnce: report.impactOnce ?? "",
      improvements: listToLines(report.improvements),
    });
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

  async function handleExportPdf() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      await exportReportPdf(
        reportRef.current,
        `${report.title}-${report.period}`,
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
      const next = await updateAnalysisItem<WorkReport>("reports", report.id, {
        ...report,
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        period: draft.period.trim(),
        person: draft.person.trim(),
        role: draft.role.trim(),
        headline: draft.headline.trim(),
        executiveBrief: draft.executiveBrief.trim(),
        keyInsight: draft.keyInsight.trim(),
        deliveryUnlock: draft.deliveryUnlock.trim(),
        impactOnce: draft.impactOnce.trim(),
        improvements: linesToList(draft.improvements),
      });
      onSaved(normalizeWorkReport(next));
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
      await deleteAnalysisItem("reports", report.id);
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
          All reports
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {!editing ? (
            <AnalysisRunButton tab={tab} onTabChange={setTab} />
          ) : null}
          {tab === "details" ? (
            <AnalysisItemToolbar
              editing={editing}
              saving={saving}
              deleting={deleting}
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
            />
          ) : null}
          {tab === "details" && !editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={exporting}
              onClick={() => void handleExportPdf()}
            >
              {exporting ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              {exporting ? "Exporting…" : "Export PDF"}
            </Button>
          ) : null}
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
      ) : (
      <div ref={reportRef} className="bg-background pt-6">
      {/* Header */}
      <header className="pb-2">
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>Title</FieldLabel>
              <FieldInput
                value={draft.title}
                onChange={(value) => setDraft((c) => ({ ...c, title: value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <FieldLabel>Person</FieldLabel>
                <FieldInput
                  value={draft.person}
                  onChange={(value) => setDraft((c) => ({ ...c, person: value }))}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Role</FieldLabel>
                <FieldInput
                  value={draft.role}
                  onChange={(value) => setDraft((c) => ({ ...c, role: value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Headline</FieldLabel>
              <TextArea
                value={draft.headline}
                onChange={(value) => setDraft((c) => ({ ...c, headline: value }))}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="label-caps text-muted-foreground">{report.period}</p>
            <h1 className="mt-1 font-display text-2xl tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              {report.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {report.person} · {report.role} · Generated {report.generatedAt}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-foreground sm:text-[15px]">
              {report.headline}
            </p>
          </>
        )}
      </header>

      {/* 01 Summary */}
      <Section step="01" title="Summary">
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>Executive brief</FieldLabel>
              <TextArea
                value={draft.executiveBrief}
                onChange={(value) =>
                  setDraft((c) => ({ ...c, executiveBrief: value }))
                }
                rows={5}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Delivery unlock</FieldLabel>
                <FieldInput
                  value={draft.deliveryUnlock}
                  onChange={(value) =>
                    setDraft((c) => ({ ...c, deliveryUnlock: value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Impact once</FieldLabel>
                <FieldInput
                  value={draft.impactOnce}
                  onChange={(value) =>
                    setDraft((c) => ({ ...c, impactOnce: value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Improvements</FieldLabel>
              <TextArea
                value={draft.improvements}
                onChange={(value) =>
                  setDraft((c) => ({ ...c, improvements: value }))
                }
                rows={4}
              />
              <p className="text-xs text-muted-foreground">One item per line</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-foreground/90 sm:text-[15px]">
              {report.executiveBrief}
            </p>
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
        )}
      </Section>

      {/* 02 Snapshot */}
      <Section step="02" title="Week snapshot">
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
      <Section step="03" title="Where time went">
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
      <Section step="04" title="Daily cadence">
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
      <Section step="05" title="What they did">
        <ul className="space-y-2.5">
          {report.whatTheyDid.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-2 size-1 shrink-0 bg-foreground/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="mt-6 mb-3 text-sm font-medium text-foreground">Timeline</p>
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

      {/* 06 Repetition */}
      <Section step="06" title="Repetitive work">
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

      {/* 07 Bottlenecks */}
      <Section step="07" title="Bottlenecks">
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

      {/* 08 Opportunities */}
      <Section step="08" title="Opportunities">
        <ul className="space-y-3">
          {[...report.opportunities]
            .sort(
              (a, b) =>
                b.impact / Math.max(b.effort, 1) -
                a.impact / Math.max(a.effort, 1),
            )
            .map((item, i) => (
              <li
                key={item.name}
                className="grid grid-cols-1 gap-2 border border-border px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    <span className="text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}.{" "}
                    </span>
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Impact {item.impact} · Effort {item.effort}
                  </p>
                </div>
                <span className="label-caps w-fit border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                  {item.horizon}
                </span>
              </li>
            ))}
        </ul>
      </Section>

      {/* 09 Scorecard + improve */}
      <Section step="09" title="How they can improve">
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

      {/* 10 Next steps */}
      <Section step="10" title="Next steps">
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
      )}

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete report?"
        description="This removes it from ~/.jarbas/reports. You cannot undo this."
        deleting={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export function ReportsPage() {
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState<AnalysisRunMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async (preferId?: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = (await listAnalysisItems<WorkReport>("reports")).map(
        normalizeWorkReport,
      );
      setReports(next);
      if (preferId) setSelectedId(preferId);
      return next;
    } catch (error) {
      console.error("Failed to load reports", error);
      setLoadError(error instanceof Error ? error.message : String(error));
      return [] as WorkReport[];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (run) {
    return (
      <AnalysisRunView
        meta={run}
        onCancel={() => setRun(null)}
        onErrorBack={() => setRun(null)}
        onCompleted={(ids) => {
          void refresh(ids[0]).then(() => {
            setRun(null);
          });
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
        onSaved={(next) => {
          setReports((current) =>
            current.map((item) => (item.id === next.id ? next : item)),
          );
        }}
        onDeleted={() => {
          setReports((current) =>
            current.filter((item) => item.id !== selected.id),
          );
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
            onClick={() => setOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Generate report
          </Button>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Cycle summaries of how work happened.
        </p>
      </div>

      {loadError ? (
        <p className="mt-8 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {loadError}
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
            Pick a timeframe and let Pi write a work report from your captured
            activity.
          </p>
          <Button
            type="button"
            className="mt-6 rounded-none"
            onClick={() => setOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Generate report
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
                  <CalendarDays className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold tracking-tight text-foreground">
                    {report.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {report.period}
                    {report.person ? ` · ${report.person}` : ""}
                  </span>
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
        title="Generate report"
        description="Pick a timeframe and model. Pi analyzes your capture and connected apps, then saves the report."
        confirmLabel="Generate report"
        onStarted={setRun}
      />
    </div>
  );
}
