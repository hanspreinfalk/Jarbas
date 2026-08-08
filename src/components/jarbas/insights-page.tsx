import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import {
  AnalysisItemToolbar,
  DeleteConfirmDialog,
  FieldInput,
  FieldLabel,
  TextArea,
  csvToList,
  linesToList,
  listToCsv,
  listToLines,
} from "@/components/jarbas/analysis-item-editor";
import { AnalysisChatPanel } from "@/components/jarbas/analysis-chat-panel";
import { useAnalysisRun } from "@/components/jarbas/analysis-run-provider";
import { AnalysisRunView } from "@/components/jarbas/analysis-run-view";
import { AnalyzeRangeDialog } from "@/components/jarbas/analyze-range-dialog";
import { AppBadgeList } from "@/components/jarbas/app-badge";
import { DocumentMasthead } from "@/components/jarbas/document-masthead";
import { PeriodBadge } from "@/components/jarbas/period-badge";
import { Button } from "@/components/ui/button";
import {
  deleteAnalysisItem,
  listAnalysisItems,
  updateAnalysisItem,
  type AnalysisTranscript,
} from "@/lib/analysis";
import { formatRangeLabel } from "@/lib/date-range";
import { exportReportHtml } from "@/lib/export-report-html";
import type { Insight } from "@/lib/insights";
import { cn } from "@/lib/utils";

function confidenceBadgeClass(confidence: string) {
  const value = confidence.trim().toLowerCase();
  if (value === "high") {
    return "border-primary/30 bg-primary text-primary-foreground";
  }
  if (value === "medium" || value === "med") {
    return "border-border bg-sky text-navy dark:border-sky/40 dark:bg-sky/10 dark:text-sky";
  }
  if (value === "low") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  return "border-border bg-muted text-muted-foreground";
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const label = confidence.trim() || "Unknown";
  return (
    <span
      className={cn(
        "label-caps border px-1.5 py-0.5 text-[10px]",
        confidenceBadgeClass(label),
      )}
    >
      Confidence {label}
    </span>
  );
}

type InsightDraft = {
  title: string;
  category: string;
  observed: string;
  insight: string;
  frequency: string;
  firstSeen: string;
  lastSeen: string;
  confidence: string;
  evidence: string;
  steps: string;
  relatedOpportunity: string;
  nextAction: string;
  timePattern: string;
  apps: string;
  startDate: string;
  endDate: string;
};

function toDraft(insight: Insight): InsightDraft {
  return {
    title: insight.title ?? "",
    category: insight.category ?? "",
    observed: insight.observed ?? "",
    insight: insight.insight ?? "",
    frequency: insight.frequency ?? "",
    firstSeen: insight.firstSeen ?? "",
    lastSeen: insight.lastSeen ?? "",
    confidence: insight.confidence ?? "",
    evidence: listToLines(insight.evidence),
    steps: listToLines(insight.steps),
    relatedOpportunity: insight.relatedOpportunity ?? "",
    nextAction: insight.nextAction ?? "",
    timePattern: insight.timePattern ?? "",
    apps: listToCsv(insight.apps),
    startDate: insight.startDate ?? "",
    endDate: insight.endDate ?? "",
  };
}

function InsightDetail({
  insight,
  onBack,
  onSaved,
  onDeleted,
}: {
  insight: Insight;
  onBack: () => void;
  onSaved: (insight: Insight) => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState<"details" | "ai">("details");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(insight));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(toDraft(insight));
    setEditing(false);
    setActionError(null);
  }, [insight]);

  const analysis = insight.analysis as AnalysisTranscript | undefined;
  const promptLabel = `Find patterns for ${formatRangeLabel(
    insight.startDate ?? "",
    insight.endDate ?? "",
  )}.`;

  function patchDraft<K extends keyof InsightDraft>(key: K, value: InsightDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      setActionError("Title is required.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const payload: Insight = {
        ...insight,
        title: draft.title.trim(),
        category: draft.category.trim(),
        observed: draft.observed.trim(),
        insight: draft.insight.trim(),
        frequency: draft.frequency.trim(),
        firstSeen: draft.firstSeen.trim(),
        lastSeen: draft.lastSeen.trim(),
        confidence: draft.confidence.trim(),
        evidence: linesToList(draft.evidence),
        steps: linesToList(draft.steps),
        relatedOpportunity: draft.relatedOpportunity.trim(),
        nextAction: draft.nextAction.trim(),
        timePattern: draft.timePattern.trim(),
        apps: csvToList(draft.apps),
        startDate: draft.startDate.trim(),
        endDate: draft.endDate.trim(),
      };
      const written = await updateAnalysisItem<Insight>(
        "insights",
        insight.id,
        payload,
      );
      // Re-read from local disk so the UI matches what was actually persisted.
      const listed = await listAnalysisItems<Insight>("insights");
      const saved =
        listed.find((item) => item.id === insight.id) ?? written;
      onSaved(saved);
      setDraft(toDraft(saved));
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
      await deleteAnalysisItem("insights", insight.id);
      setConfirmDelete(false);
      onDeleted();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
      setDeleting(false);
    }
  }

  async function handleExport() {
    if (!exportRef.current || exporting || editing) return;
    setExporting(true);
    setActionError(null);
    try {
      await exportReportHtml(
        exportRef.current,
        `${insight.title}-insight`,
        insight.title,
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="animate-rise mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 rounded-none text-muted-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All insights
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
              setDraft(toDraft(insight));
              setEditing(true);
              setActionError(null);
            }}
            onCancelEdit={() => {
              setDraft(toDraft(insight));
              setEditing(false);
              setActionError(null);
            }}
            onSave={() => void handleSave()}
            onDeleteRequest={() => setConfirmDelete(true)}
            onExport={() => void handleExport()}
          />
        </div>
      </div>

      <div ref={exportRef}>
      {editing ? (
        <header className="mt-6 border-b border-border pb-8">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>Title</FieldLabel>
              <FieldInput value={draft.title} onChange={(v) => patchDraft("title", v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Category</FieldLabel>
                <FieldInput value={draft.category} onChange={(v) => patchDraft("category", v)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Confidence</FieldLabel>
                <FieldInput value={draft.confidence} onChange={(v) => patchDraft("confidence", v)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Start date</FieldLabel>
                <FieldInput
                  value={draft.startDate}
                  onChange={(v) => patchDraft("startDate", v)}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>End date</FieldLabel>
                <FieldInput
                  value={draft.endDate}
                  onChange={(v) => patchDraft("endDate", v)}
                />
              </div>
            </div>
          </div>
        </header>
      ) : (
        <DocumentMasthead
          kind="Insight"
          className="mt-6"
          reference={formatRangeLabel(
            insight.startDate ?? "",
            insight.endDate ?? "",
          )}
          size="md"
          chips={<ConfidenceBadge confidence={insight.confidence} />}
          title={insight.title}
          byline={insight.category ? <p>{insight.category}</p> : undefined}
        >
          <PeriodBadge
            className="mt-3 inline-flex"
            startDate={insight.startDate}
            endDate={insight.endDate}
            firstSeen={insight.firstSeen}
            lastSeen={insight.lastSeen}
          />
        </DocumentMasthead>
      )}

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
                jobId: insight.jobId ?? insight.id,
                content: "",
                thinking: "",
                tools: [],
              }
            }
            promptLabel={promptLabel}
          />
        </div>
      ) : (
        <>
          <section className="mt-8 space-y-3">
            <h2 className="label-caps text-muted-foreground">Observed</h2>
            {editing ? (
              <TextArea value={draft.observed} onChange={(v) => patchDraft("observed", v)} rows={4} />
            ) : (
              <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
                {insight.observed}
              </p>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Frequency</h2>
            {editing ? (
              <TextArea
                value={draft.frequency}
                onChange={(v) => patchDraft("frequency", v)}
                rows={2}
              />
            ) : (
              <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
                {insight.frequency}
              </p>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Insight</h2>
            {editing ? (
              <TextArea value={draft.insight} onChange={(v) => patchDraft("insight", v)} rows={4} />
            ) : (
              <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
                {insight.insight}
              </p>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Repeatable steps</h2>
            {editing ? (
              <>
                <TextArea value={draft.steps} onChange={(v) => patchDraft("steps", v)} rows={5} />
                <p className="text-xs text-muted-foreground">One step per line</p>
              </>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
                {(insight.steps ?? []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Evidence</h2>
            {editing ? (
              <>
                <TextArea value={draft.evidence} onChange={(v) => patchDraft("evidence", v)} rows={5} />
                <p className="text-xs text-muted-foreground">One evidence item per line</p>
              </>
            ) : (
              <ul className="space-y-2 text-sm leading-relaxed text-foreground">
                {(insight.evidence ?? []).map((item) => (
                  <li key={item} className="border border-border bg-card px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8 grid gap-6 border-t border-border pt-8 sm:grid-cols-2">
            <div className="space-y-2">
              <h2 className="label-caps text-muted-foreground">Time pattern</h2>
              {editing ? (
                <FieldInput value={draft.timePattern} onChange={(v) => patchDraft("timePattern", v)} />
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {insight.timePattern}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <h2 className="label-caps text-muted-foreground">Related opportunity</h2>
              {editing ? (
                <FieldInput
                  value={draft.relatedOpportunity}
                  onChange={(v) => patchDraft("relatedOpportunity", v)}
                />
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {insight.relatedOpportunity}
                </p>
              )}
            </div>
          </section>

          <section className="mt-8 grid gap-6 border-t border-border pt-8 sm:grid-cols-2">
            <div className="space-y-2">
              <h2 className="label-caps text-muted-foreground">First seen</h2>
              {editing ? (
                <FieldInput value={draft.firstSeen} onChange={(v) => patchDraft("firstSeen", v)} />
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {insight.firstSeen}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <h2 className="label-caps text-muted-foreground">Last seen</h2>
              {editing ? (
                <FieldInput value={draft.lastSeen} onChange={(v) => patchDraft("lastSeen", v)} />
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {insight.lastSeen}
                </p>
              )}
            </div>
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Next action</h2>
            {editing ? (
              <TextArea value={draft.nextAction} onChange={(v) => patchDraft("nextAction", v)} rows={3} />
            ) : (
              <p className="border border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground">
                {insight.nextAction}
              </p>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Apps</h2>
            {editing ? (
              <>
                <FieldInput value={draft.apps} onChange={(v) => patchDraft("apps", v)} />
                <p className="text-xs text-muted-foreground">Comma-separated</p>
              </>
            ) : (
              <AppBadgeList apps={insight.apps ?? []} />
            )}
          </section>
        </>
      )}
      </div>

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete insight?"
        description="This permanently deletes the insight. You cannot undo this."
        deleting={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export function InsightsPage() {
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { meta, startRun, clearRun } = useAnalysisRun();

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await listAnalysisItems<Insight>("insights");
      setItems(next);
      return next;
    } catch (error) {
      console.error("Failed to load insights", error);
      setLoadError(error instanceof Error ? error.message : String(error));
      return [] as Insight[];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (meta?.kind === "insights") {
    return (
      <AnalysisRunView
        onErrorBack={() => clearRun()}
        onCompleted={({ ids }) => {
          void refresh().then(() => {
            clearRun();
            if (ids[0]) setSelectedId(ids[0]);
          });
        }}
      />
    );
  }

  const selected = items.find((insight) => insight.id === selectedId);

  if (selected) {
    return (
      <InsightDetail
        insight={selected}
        onBack={() => setSelectedId(null)}
        onSaved={(next) => {
          setItems((current) =>
            current.map((item) => (item.id === next.id ? next : item)),
          );
        }}
        onDeleted={() => {
          setItems((current) => current.filter((item) => item.id !== selected.id));
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
            Insights
          </h1>
          <Button
            type="button"
            className="shrink-0 rounded-none self-start sm:self-auto"
            onClick={() => setOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Find patterns
          </Button>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Observations about how you work, think, and get things done.
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
          Loading insights…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 border border-border bg-card px-5 py-10 text-center">
          <p className="font-display text-xl tracking-tight text-foreground">
            No insights yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Choose a date range to find patterns in how you work - your rituals,
            sequences, and how you think through tasks.
          </p>
          <Button
            type="button"
            className="mt-6 rounded-none"
            onClick={() => setOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Find patterns
          </Button>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-border border border-border bg-card">
          {items.map((insight, index) => {
            return (
            <li key={insight.id}>
              <button
                type="button"
                onClick={() => setSelectedId(insight.id)}
                className="animate-rise w-full px-4 py-4 text-left transition-colors hover:bg-muted sm:px-5"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <span className="label-caps border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {insight.category}
                  </span>
                  <PeriodBadge
                    startDate={insight.startDate}
                    endDate={insight.endDate}
                    firstSeen={insight.firstSeen}
                    lastSeen={insight.lastSeen}
                  />
                </div>
                <h2 className="mt-2 text-sm font-semibold tracking-tight text-foreground sm:text-base">
                  {insight.title}
                </h2>
                {insight.observed ? (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {insight.observed}
                  </p>
                ) : null}
                <AppBadgeList apps={insight.apps ?? []} className="mt-3" />
              </button>
            </li>
            );
          })}
        </ul>
      )}

      <AnalyzeRangeDialog
        open={open}
        onOpenChange={setOpen}
        kind="insights"
        title="Find patterns"
        description="Choose dates to review. Jarbas studies how you work and think from your screen activity and connected apps."
        confirmLabel="Find patterns"
        onStarted={startRun}
      />
    </div>
  );
}
