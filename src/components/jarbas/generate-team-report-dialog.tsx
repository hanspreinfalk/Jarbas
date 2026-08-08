import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { ModelPicker } from "@/components/jarbas/model-picker";
import { ReportCloudBanner } from "@/components/jarbas/report-cloud-banner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DATE_RANGE_PRESETS,
  formatRangeLabel,
  toInputDate,
  type RangePreset,
} from "@/lib/date-range";
import {
  getLlmSettings,
  providerHasKey,
  setLlmModel,
  type LlmProvider,
  type LlmSettings,
} from "@/lib/llm-settings";
import { cn } from "@/lib/utils";

export type TeamReportPerson = {
  userId: string;
  name: string;
  email: string | null;
  imageUrl: string | null;
  reportCount: number;
};

export type GenerateTeamReportValues = {
  startDate: string;
  endDate: string;
  clerkUserIds: string[];
  memberLabels: { clerkUserId: string; name: string }[];
  provider: LlmProvider;
  model: string;
};

export function GenerateTeamReportDialog({
  open,
  onOpenChange,
  people,
  submitting = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: TeamReportPerson[];
  submitting?: boolean;
  onConfirm: (values: GenerateTeamReportValues) => void | Promise<void>;
}) {
  const [presetId, setPresetId] = useState<string | "custom">("last-7");
  const [startDate, setStartDate] = useState(() => toInputDate(new Date()));
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);

  const rangeValid = Boolean(startDate && endDate && startDate <= endDate);
  const selectedCount = selectedIds.length;
  const hasKey = providerHasKey(
    llmSettings,
    llmSettings?.provider ?? "anthropic",
  );

  const applyPreset = useCallback((preset: RangePreset) => {
    const { start, end } = preset.getRange();
    setPresetId(preset.id);
    setStartDate(toInputDate(start));
    setEndDate(toInputDate(end));
  }, []);

  useEffect(() => {
    if (!open) return;
    const preset =
      DATE_RANGE_PRESETS.find((p) => p.id === "last-7") ?? DATE_RANGE_PRESETS[0];
    applyPreset(preset);
    setSelectedIds(people.map((person) => person.userId));
    setError(null);
    let cancelled = false;
    void getLlmSettings()
      .then((settings) => {
        if (!cancelled) setLlmSettings(settings);
      })
      .catch((err) => {
        console.error("Failed to load LLM settings", err);
      });
    return () => {
      cancelled = true;
    };
  }, [open, people, applyPreset]);

  const allSelected = people.length > 0 && selectedIds.length === people.length;

  const selectedPeople = useMemo(
    () => people.filter((person) => selectedIds.includes(person.userId)),
    [people, selectedIds],
  );

  function togglePerson(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : people.map((person) => person.userId));
  }

  async function onModelSelect(provider: LlmProvider, model: string) {
    try {
      const next = await setLlmModel(provider, model);
      setLlmSettings(next);
    } catch (err) {
      console.error("Failed to save model selection", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleConfirm() {
    if (!rangeValid || submitting || !llmSettings) return;
    if (selectedIds.length === 0) {
      setError("Select at least one person.");
      return;
    }
    if (!hasKey) {
      const label =
        llmSettings.providers.find((p) => p.id === llmSettings.provider)
          ?.label ?? "provider";
      setError(`Add a ${label} key in Settings first.`);
      return;
    }
    setError(null);
    await onConfirm({
      startDate,
      endDate,
      clerkUserIds: selectedIds,
      memberLabels: selectedPeople.map((person) => ({
        clerkUserId: person.userId,
        name: person.name,
      })),
      provider: llmSettings.provider,
      model: llmSettings.model,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="rounded-none sm:max-w-lg"
        showCloseButton={!submitting}
      >
        <DialogHeader>
          <DialogTitle>
            {submitting ? "Generating team report" : "Generate team report"}
          </DialogTitle>
          <DialogDescription>
            {submitting
              ? "Staging selected reports for a deep board-ready synthesis."
              : "Pick a timeframe and people. Jarbas synthesizes their reports into one."}
          </DialogDescription>
        </DialogHeader>

        {submitting ? (
          <div className="flex items-center gap-3 border border-border bg-muted/40 px-3 py-3 text-sm text-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <div className="min-w-0">
              <p className="font-medium">Working…</p>
              <p className="mt-0.5 text-muted-foreground">
                Starting the team synthesis run…
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <ReportCloudBanner tense="will" />
            <div>
              <p className="label-caps text-muted-foreground">Timeframe</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DATE_RANGE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      presetId === preset.id
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Start</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setPresetId("custom");
                      setStartDate(event.target.value);
                    }}
                    className="rounded-none"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">End</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(event) => {
                      setPresetId("custom");
                      setEndDate(event.target.value);
                    }}
                    className="rounded-none"
                  />
                </label>
              </div>
              {!rangeValid ? (
                <p className="mt-2 text-xs text-destructive">
                  End date must be on or after start date.
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Selected · {formatRangeLabel(startDate, endDate)}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="label-caps text-muted-foreground">People</p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {allSelected ? "Clear all" : "Select all"}
                </button>
              </div>
              <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto border border-border bg-card">
                {people.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No people in this organization.
                  </li>
                ) : (
                  people.map((person) => {
                    const selected = selectedIds.includes(person.userId);
                    return (
                      <li key={person.userId}>
                        <button
                          type="button"
                          onClick={() => togglePerson(person.userId)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center border",
                              selected
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-background",
                            )}
                          >
                            {selected ? <Check className="size-3" /> : null}
                          </span>
                          {person.imageUrl ? (
                            <img
                              src={person.imageUrl}
                              alt=""
                              className="size-7 shrink-0 border border-border object-cover"
                            />
                          ) : (
                            <span className="flex size-7 shrink-0 items-center justify-center border border-border bg-background font-display text-xs text-muted-foreground">
                              {person.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {person.name}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {person.reportCount === 0
                                ? "No report yet"
                                : `${person.reportCount} report${person.reportCount === 1 ? "" : "s"}`}
                              {person.email ? ` · ${person.email}` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedCount} selected · AI reads each person’s report in range,
                then writes one board-ready team deliverable.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 border border-border bg-muted/30 px-3 py-2.5">
              <div className="min-w-0">
                <p className="label-caps text-muted-foreground">Which AI</p>
              </div>
              <ModelPicker
                settings={llmSettings}
                onSelect={onModelSelect}
                side="bottom"
                align="end"
              />
            </div>
          </div>
        )}

        {error ? (
          <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            className="rounded-none"
            disabled={!rangeValid || submitting || selectedCount === 0 || !llmSettings || !hasKey}
            onClick={() => void handleConfirm()}
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                Generate team report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
