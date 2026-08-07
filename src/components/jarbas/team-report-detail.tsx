import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft } from "lucide-react";
import {
  AnalysisItemToolbar,
  DeleteConfirmDialog,
  FieldInput,
  FieldLabel,
  TextArea,
} from "@/components/jarbas/analysis-item-editor";
import { Button } from "@/components/ui/button";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  normalizeTeamWorkReport,
  type TeamWorkReport,
} from "@/lib/team-reports";
import { cn } from "@/lib/utils";

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
    setActionError(null);
  }, [report]);

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
      </div>

      {actionError ? (
        <p className="mt-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <header className="mt-6 pb-2">
        <p className="label-caps text-muted-foreground">Team report</p>
        {editing ? (
          <div className="mt-3 space-y-4">
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
                onChange={(value) =>
                  setDraft((c) => ({ ...c, subtitle: value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Period</FieldLabel>
              <FieldInput
                value={draft.period}
                onChange={(value) => setDraft((c) => ({ ...c, period: value }))}
              />
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
              {report.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {report.subtitle}
              {report.period ? ` · ${report.period}` : ""}
            </p>
          </>
        )}
      </header>

      <section className="mt-8 space-y-3 border-t border-border pt-8">
        <h2 className="label-caps text-muted-foreground">Executive brief</h2>
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>Headline</FieldLabel>
              <FieldInput
                value={draft.headline}
                onChange={(value) =>
                  setDraft((c) => ({ ...c, headline: value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Brief</FieldLabel>
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
          </div>
        ) : (
          <>
            <p className="font-display text-xl tracking-tight text-foreground sm:text-2xl">
              {report.headline}
            </p>
            <p className="text-sm leading-relaxed text-foreground sm:text-[15px]">
              {report.executiveBrief}
            </p>
            {report.keyInsight ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Key insight · </span>
                {report.keyInsight}
              </p>
            ) : null}
            {report.deliveryUnlock ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Unlock · </span>
                {report.deliveryUnlock}
              </p>
            ) : null}
          </>
        )}
      </section>

      {report.kpis.length > 0 ? (
        <section className="mt-10 space-y-3 border-t border-border pt-8">
          <h2 className="label-caps text-muted-foreground">Team snapshot</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {report.kpis.map((kpi) => (
              <div
                key={`${kpi.label}-${kpi.value}`}
                className="border border-border bg-card px-3 py-3"
              >
                <p className="label-caps text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 font-display text-2xl tracking-tight text-foreground">
                  {kpi.value}
                </p>
                {kpi.delta ? (
                  <p className="mt-1 text-xs text-muted-foreground">{kpi.delta}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report.memberSnapshots.length > 0 ? (
        <section className="mt-10 space-y-3 border-t border-border pt-8">
          <h2 className="label-caps text-muted-foreground">Member snapshots</h2>
          <ul className="divide-y divide-border border border-border bg-card">
            {report.memberSnapshots.map((member) => (
              <li key={`${member.person}-${member.clerkUserId}`} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold tracking-tight text-foreground">
                    {member.person}
                  </p>
                  {member.role ? (
                    <span className="text-xs text-muted-foreground">{member.role}</span>
                  ) : null}
                </div>
                {member.headline ? (
                  <p className="mt-1 text-sm text-foreground">{member.headline}</p>
                ) : null}
                {member.strengths.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Strengths · {member.strengths.join(" · ")}
                  </p>
                ) : null}
                {member.risks.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Risks · {member.risks.join(" · ")}
                  </p>
                ) : null}
                {member.topOpportunity ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Top unlock · {member.topOpportunity}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.teamFindings.length > 0 ? (
        <section className="mt-10 space-y-3 border-t border-border pt-8">
          <h2 className="label-caps text-muted-foreground">Team findings</h2>
          <ul className="space-y-3">
            {report.teamFindings.map((finding) => (
              <li key={finding.title} className="border border-border bg-card px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{finding.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {finding.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.sharedPatterns.length > 0 ? (
        <section className="mt-10 space-y-3 border-t border-border pt-8">
          <h2 className="label-caps text-muted-foreground">Shared patterns</h2>
          <ul className="space-y-3">
            {report.sharedPatterns.map((pattern) => (
              <li key={pattern.title} className="border border-border bg-card px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{pattern.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {pattern.detail}
                </p>
                {pattern.members.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Seen in · {pattern.members.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.teamOpportunities.length > 0 ? (
        <section className="mt-10 space-y-3 border-t border-border pt-8">
          <h2 className="label-caps text-muted-foreground">Team opportunities</h2>
          <ul className="space-y-3">
            {report.teamOpportunities.map((item) => (
              <li key={item.name} className="border border-border bg-card px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.unlock}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  From {item.fromPattern || "shared pattern"}
                  {item.horizon ? ` · ${item.horizon}` : ""}
                  {item.owners.length ? ` · ${item.owners.join(", ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.nextSteps.length > 0 ? (
        <section className="mt-10 space-y-3 border-t border-border pt-8">
          <h2 className="label-caps text-muted-foreground">Next steps</h2>
          <ul className="space-y-2">
            {report.nextSteps.map((step) => (
              <li
                key={`${step.action}-${step.owner}`}
                className={cn(
                  "border border-border bg-card px-4 py-3 text-sm text-foreground",
                )}
              >
                <p className="font-medium">{step.action}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.owner}
                  {step.when ? ` · ${step.when}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
