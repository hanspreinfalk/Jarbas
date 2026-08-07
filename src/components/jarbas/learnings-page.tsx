import { useCallback, useEffect, useState } from "react";
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
import { AnalysisRunButton } from "@/components/jarbas/detail-ai-tabs";
import { Button } from "@/components/ui/button";
import {
  deleteAnalysisItem,
  listAnalysisItems,
  updateAnalysisItem,
  type AnalysisTranscript,
} from "@/lib/analysis";
import { formatRangeLabel, formatStartEndLabel } from "@/lib/date-range";
import type { Learning } from "@/lib/learnings";
import { cn } from "@/lib/utils";

function confidenceBadgeClass(confidence: string) {
  const value = confidence.trim().toLowerCase();
  if (value === "high") {
    return "border-primary/30 bg-primary text-primary-foreground";
  }
  if (value === "medium" || value === "med") {
    return "border-border bg-sky text-navy";
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

type LearningDraft = {
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
};

function toDraft(learning: Learning): LearningDraft {
  return {
    title: learning.title ?? "",
    category: learning.category ?? "",
    observed: learning.observed ?? "",
    insight: learning.insight ?? "",
    frequency: learning.frequency ?? "",
    firstSeen: learning.firstSeen ?? "",
    lastSeen: learning.lastSeen ?? "",
    confidence: learning.confidence ?? "",
    evidence: listToLines(learning.evidence),
    steps: listToLines(learning.steps),
    relatedOpportunity: learning.relatedOpportunity ?? "",
    nextAction: learning.nextAction ?? "",
    timePattern: learning.timePattern ?? "",
    apps: listToCsv(learning.apps),
  };
}

function LearningDetail({
  learning,
  onBack,
  onSaved,
  onDeleted,
}: {
  learning: Learning;
  onBack: () => void;
  onSaved: (learning: Learning) => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState<"details" | "ai">("details");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(learning));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toDraft(learning));
    setEditing(false);
    setActionError(null);
  }, [learning]);

  const analysis = learning.analysis as AnalysisTranscript | undefined;
  const promptLabel = `Find patterns for ${formatRangeLabel(
    learning.startDate ?? "",
    learning.endDate ?? "",
  )}.`;

  function patchDraft<K extends keyof LearningDraft>(key: K, value: LearningDraft[K]) {
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
      const next = await updateAnalysisItem<Learning>("learnings", learning.id, {
        ...learning,
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
      });
      onSaved(next);
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
      await deleteAnalysisItem("learnings", learning.id);
      setConfirmDelete(false);
      onDeleted();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
      setDeleting(false);
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
          All learnings
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
                setDraft(toDraft(learning));
                setEditing(true);
                setActionError(null);
              }}
              onCancelEdit={() => {
                setDraft(toDraft(learning));
                setEditing(false);
                setActionError(null);
              }}
              onSave={() => void handleSave()}
              onDeleteRequest={() => setConfirmDelete(true)}
            />
          ) : null}
        </div>
      </div>

      <header className="mt-6 border-b border-border pb-8">
        {editing ? (
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
            </div>
          </div>
        ) : (
          <>
            <ConfidenceBadge confidence={learning.confidence} />
            <h1 className="mt-3 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
              {learning.title}
            </h1>
            {learning.category ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {learning.category}
              </p>
            ) : null}
            {formatStartEndLabel(learning.startDate, learning.endDate) ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {formatStartEndLabel(learning.startDate, learning.endDate)}
              </p>
            ) : null}
          </>
        )}
      </header>

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
                jobId: learning.jobId ?? learning.id,
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
                {learning.observed}
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
                {learning.frequency}
              </p>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Insight</h2>
            {editing ? (
              <TextArea value={draft.insight} onChange={(v) => patchDraft("insight", v)} rows={4} />
            ) : (
              <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
                {learning.insight}
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
                {(learning.steps ?? []).map((step) => (
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
                {(learning.evidence ?? []).map((item) => (
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
                  {learning.timePattern}
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
                  {learning.relatedOpportunity}
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
                  {learning.firstSeen}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <h2 className="label-caps text-muted-foreground">Last seen</h2>
              {editing ? (
                <FieldInput value={draft.lastSeen} onChange={(v) => patchDraft("lastSeen", v)} />
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {learning.lastSeen}
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
                {learning.nextAction}
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
              <AppBadgeList apps={learning.apps ?? []} />
            )}
          </section>
        </>
      )}

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete learning?"
        description="This permanently deletes the learning. You cannot undo this."
        deleting={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export function LearningsPage() {
  const [items, setItems] = useState<Learning[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { meta, startRun, clearRun } = useAnalysisRun();

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await listAnalysisItems<Learning>("learnings");
      setItems(next);
      return next;
    } catch (error) {
      console.error("Failed to load learnings", error);
      setLoadError(error instanceof Error ? error.message : String(error));
      return [] as Learning[];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (meta?.kind === "learnings") {
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

  const selected = items.find((learning) => learning.id === selectedId);

  if (selected) {
    return (
      <LearningDetail
        learning={selected}
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
            Learnings
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
          Loading learnings…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 border border-border bg-card px-5 py-10 text-center">
          <p className="font-display text-xl tracking-tight text-foreground">
            No learnings yet
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
          {items.map((learning, index) => {
            const rangeLabel = formatStartEndLabel(
              learning.startDate,
              learning.endDate,
            );
            return (
            <li key={learning.id}>
              <button
                type="button"
                onClick={() => setSelectedId(learning.id)}
                className="animate-rise w-full px-4 py-4 text-left transition-colors hover:bg-muted sm:px-5"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <span className="label-caps border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {learning.category}
                  </span>
                  {rangeLabel ? (
                    <span className="text-xs text-muted-foreground">
                      {rangeLabel}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-sm font-semibold tracking-tight text-foreground sm:text-base">
                  {learning.title}
                </h2>
                {learning.observed ? (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {learning.observed}
                  </p>
                ) : null}
                <AppBadgeList apps={learning.apps ?? []} className="mt-3" />
              </button>
            </li>
            );
          })}
        </ul>
      )}

      <AnalyzeRangeDialog
        open={open}
        onOpenChange={setOpen}
        kind="learnings"
        title="Find patterns"
        description="Choose dates to review. Jarbas studies how you work and think from your screen activity and connected apps."
        confirmLabel="Find patterns"
        onStarted={startRun}
      />
    </div>
  );
}
