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
import type { Opportunity } from "@/lib/opportunities";

type OpportunityDraft = {
  title: string;
  category: string;
  signal: string;
  unlock: string;
  impact: string;
  effort: string;
  horizon: string;
  whyNow: string;
  successMetric: string;
  owner: string;
  relatedLearning: string;
  hoursSavedPerCycle: string;
  deliveryPlan: string;
  prerequisites: string;
  risks: string;
  apps: string;
};

function toDraft(opportunity: Opportunity): OpportunityDraft {
  return {
    title: opportunity.title ?? "",
    category: opportunity.category ?? "",
    signal: opportunity.signal ?? "",
    unlock: opportunity.unlock ?? "",
    impact: opportunity.impact ?? "",
    effort: opportunity.effort ?? "",
    horizon: opportunity.horizon ?? "",
    whyNow: opportunity.whyNow ?? "",
    successMetric: opportunity.successMetric ?? "",
    owner: opportunity.owner ?? "",
    relatedLearning: opportunity.relatedLearning ?? "",
    hoursSavedPerCycle: opportunity.hoursSavedPerCycle ?? "",
    deliveryPlan: listToLines(opportunity.deliveryPlan),
    prerequisites: listToLines(opportunity.prerequisites),
    risks: listToLines(opportunity.risks),
    apps: listToCsv(opportunity.apps),
  };
}

function OpportunityDetail({
  opportunity,
  onBack,
  onSaved,
  onDeleted,
}: {
  opportunity: Opportunity;
  onBack: () => void;
  onSaved: (opportunity: Opportunity) => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState<"details" | "ai">("details");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(opportunity));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(toDraft(opportunity));
    setEditing(false);
    setActionError(null);
  }, [opportunity]);

  const analysis = opportunity.analysis as AnalysisTranscript | undefined;
  const promptLabel = `Find opportunities for ${formatRangeLabel(
    opportunity.startDate ?? "",
    opportunity.endDate ?? "",
  )}.`;

  function patchDraft<K extends keyof OpportunityDraft>(
    key: K,
    value: OpportunityDraft[K],
  ) {
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
      const next = await updateAnalysisItem<Opportunity>(
        "opportunities",
        opportunity.id,
        {
          ...opportunity,
          title: draft.title.trim(),
          category: draft.category.trim(),
          signal: draft.signal.trim(),
          unlock: draft.unlock.trim(),
          impact: draft.impact.trim(),
          effort: draft.effort.trim(),
          horizon: draft.horizon.trim(),
          whyNow: draft.whyNow.trim(),
          successMetric: draft.successMetric.trim(),
          owner: draft.owner.trim(),
          relatedLearning: draft.relatedLearning.trim(),
          hoursSavedPerCycle: draft.hoursSavedPerCycle.trim(),
          deliveryPlan: linesToList(draft.deliveryPlan),
          prerequisites: linesToList(draft.prerequisites),
          risks: linesToList(draft.risks),
          apps: csvToList(draft.apps),
        },
      );
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
      await deleteAnalysisItem("opportunities", opportunity.id);
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
          All opportunities
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
                setDraft(toDraft(opportunity));
                setEditing(true);
                setActionError(null);
              }}
              onCancelEdit={() => {
                setDraft(toDraft(opportunity));
                setEditing(false);
                setActionError(null);
              }}
              onSave={() => void handleSave()}
              onDeleteRequest={() => setConfirmDelete(true)}
            />
          ) : null}
        </div>
      </div>

      <header className="mt-6 border-b border-border pb-6">
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>Title</FieldLabel>
              <FieldInput value={draft.title} onChange={(v) => patchDraft("title", v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <FieldLabel>Category</FieldLabel>
                <FieldInput value={draft.category} onChange={(v) => patchDraft("category", v)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Horizon</FieldLabel>
                <FieldInput value={draft.horizon} onChange={(v) => patchDraft("horizon", v)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Impact</FieldLabel>
                <FieldInput value={draft.impact} onChange={(v) => patchDraft("impact", v)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Effort</FieldLabel>
                <FieldInput value={draft.effort} onChange={(v) => patchDraft("effort", v)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Owner</FieldLabel>
                <FieldInput value={draft.owner} onChange={(v) => patchDraft("owner", v)} />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>Hours saved / cycle</FieldLabel>
                <FieldInput
                  value={draft.hoursSavedPerCycle}
                  onChange={(v) => patchDraft("hoursSavedPerCycle", v)}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-caps border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {opportunity.category}
              </span>
              <span className="text-xs text-muted-foreground">
                {opportunity.horizon}
              </span>
              <span className="text-xs text-muted-foreground">
                Impact {opportunity.impact}
              </span>
              <span className="text-xs text-muted-foreground">
                Effort {opportunity.effort}
              </span>
            </div>
            <h1 className="mt-3 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
              {opportunity.title}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Owner {opportunity.owner} · Saves {opportunity.hoursSavedPerCycle}
            </p>
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
                jobId: opportunity.jobId ?? opportunity.id,
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
            <h2 className="label-caps text-muted-foreground">From learning</h2>
            {editing ? (
              <TextArea value={draft.signal} onChange={(v) => patchDraft("signal", v)} rows={4} />
            ) : (
              <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
                {opportunity.signal}
              </p>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Unlock</h2>
            {editing ? (
              <TextArea value={draft.unlock} onChange={(v) => patchDraft("unlock", v)} rows={4} />
            ) : (
              <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
                {opportunity.unlock}
              </p>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Why now</h2>
            {editing ? (
              <TextArea value={draft.whyNow} onChange={(v) => patchDraft("whyNow", v)} rows={4} />
            ) : (
              <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
                {opportunity.whyNow}
              </p>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Delivery plan</h2>
            {editing ? (
              <>
                <TextArea
                  value={draft.deliveryPlan}
                  onChange={(v) => patchDraft("deliveryPlan", v)}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">One step per line</p>
              </>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
                {(opportunity.deliveryPlan ?? []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-8 grid gap-6 border-t border-border pt-8 sm:grid-cols-2">
            <div className="space-y-2">
              <h2 className="label-caps text-muted-foreground">Success metric</h2>
              {editing ? (
                <FieldInput
                  value={draft.successMetric}
                  onChange={(v) => patchDraft("successMetric", v)}
                />
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {opportunity.successMetric}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <h2 className="label-caps text-muted-foreground">Related learning</h2>
              {editing ? (
                <FieldInput
                  value={draft.relatedLearning}
                  onChange={(v) => patchDraft("relatedLearning", v)}
                />
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {opportunity.relatedLearning}
                </p>
              )}
            </div>
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Prerequisites</h2>
            {editing ? (
              <>
                <TextArea
                  value={draft.prerequisites}
                  onChange={(v) => patchDraft("prerequisites", v)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">One item per line</p>
              </>
            ) : (
              <ul className="space-y-2 text-sm leading-relaxed text-foreground">
                {(opportunity.prerequisites ?? []).map((item) => (
                  <li key={item} className="border border-border bg-card px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-8">
            <h2 className="label-caps text-muted-foreground">Risks</h2>
            {editing ? (
              <>
                <TextArea value={draft.risks} onChange={(v) => patchDraft("risks", v)} rows={4} />
                <p className="text-xs text-muted-foreground">One item per line</p>
              </>
            ) : (
              <ul className="space-y-2 text-sm leading-relaxed text-foreground">
                {(opportunity.risks ?? []).map((item) => (
                  <li key={item} className="border border-border bg-card px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
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
              <AppBadgeList apps={opportunity.apps ?? []} />
            )}
          </section>
        </>
      )}

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete opportunity?"
        description="This permanently deletes the opportunity. You cannot undo this."
        deleting={deleting}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export function OpportunitiesPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { meta, startRun, clearRun } = useAnalysisRun();

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await listAnalysisItems<Opportunity>("opportunities");
      setItems(next);
      return next;
    } catch (error) {
      console.error("Failed to load opportunities", error);
      setLoadError(error instanceof Error ? error.message : String(error));
      return [] as Opportunity[];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (meta?.kind === "opportunities") {
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

  const selected = items.find((opportunity) => opportunity.id === selectedId);

  if (selected) {
    return (
      <OpportunityDetail
        opportunity={selected}
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
            Opportunities
          </h1>
          <Button
            type="button"
            className="shrink-0 rounded-none self-start sm:self-auto"
            onClick={() => setOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Find opportunities
          </Button>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          Improvement unlocks derived from your learnings - automations and
          shortcuts ready to ship.
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
          Loading opportunities…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 border border-border bg-card px-5 py-10 text-center">
          <p className="font-display text-xl tracking-tight text-foreground">
            No opportunities yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            From how you actually work, Jarbas suggests unlocks, automation
            ideas, and plans you can ship in weeks.
          </p>
          <Button
            type="button"
            className="mt-6 rounded-none"
            onClick={() => setOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Find opportunities
          </Button>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-border border border-border bg-card">
          {items.map((opportunity, index) => {
            const rangeLabel = formatStartEndLabel(
              opportunity.startDate,
              opportunity.endDate,
            );
            return (
            <li key={opportunity.id}>
              <button
                type="button"
                onClick={() => setSelectedId(opportunity.id)}
                className="animate-rise w-full px-4 py-4 text-left transition-colors hover:bg-muted sm:px-5"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="label-caps border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {opportunity.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {opportunity.horizon}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Impact {opportunity.impact}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Effort {opportunity.effort}
                    </span>
                  </div>
                  {rangeLabel ? (
                    <span className="text-xs text-muted-foreground">
                      {rangeLabel}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-sm font-semibold tracking-tight text-foreground sm:text-base">
                  {opportunity.title}
                </h2>
                {opportunity.signal ? (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {opportunity.signal}
                  </p>
                ) : null}
                <AppBadgeList apps={opportunity.apps ?? []} className="mt-3" />
              </button>
            </li>
            );
          })}
        </ul>
      )}

      <AnalyzeRangeDialog
        open={open}
        onOpenChange={setOpen}
        kind="opportunities"
        title="Find opportunities"
        description="Choose dates to review. Jarbas turns how you work into unlocks, automation ideas, and clear next steps."
        confirmLabel="Find opportunities"
        onStarted={startRun}
      />
    </div>
  );
}
