import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import { Loader2, Sparkles } from "lucide-react";
import { ModelPicker } from "@/components/jarbas/model-picker";
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
import { api } from "@convex/_generated/api";
import {
  startAnalysis,
  type AnalysisKind,
  type AnalysisRunMeta,
} from "@/lib/analysis";
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

type AnalyzeRangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AnalysisKind;
  title: string;
  description: string;
  confirmLabel: string;
  onStarted: (meta: AnalysisRunMeta) => void;
};

function startingCopy(kind: AnalysisKind): { title: string; detail: string } {
  switch (kind) {
    case "learnings":
      return {
        title: "Starting learnings",
        detail: "Kicking off analysis of how you work. This can take a moment.",
      };
    case "opportunities":
      return {
        title: "Starting opportunities",
        detail: "Kicking off opportunity analysis. This can take a moment.",
      };
    case "reports":
      return {
        title: "Starting report",
        detail: "Kicking off your work report. This can take a moment.",
      };
    case "team-reports":
      return {
        title: "Starting team report",
        detail: "Kicking off multi-team analysis. This can take a moment.",
      };
  }
}

export function AnalyzeRangeDialog({
  open,
  onOpenChange,
  kind,
  title,
  description,
  confirmLabel,
  onStarted,
}: AnalyzeRangeDialogProps) {
  const { user } = useUser();
  const me = useQuery(api.user.me);
  const composioUserId = me?.user?.composioUserId ?? user?.id ?? null;

  const [presetId, setPresetId] = useState<string | "custom">("today");
  const [startDate, setStartDate] = useState(() => toInputDate(new Date()));
  const [endDate, setEndDate] = useState(() => toInputDate(new Date()));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);

  const rangeValid = Boolean(startDate && endDate && startDate <= endDate);
  const hasKey = providerHasKey(
    llmSettings,
    llmSettings?.provider ?? "anthropic",
  );
  const loading = startingCopy(kind);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const applyPreset = useCallback((preset: RangePreset) => {
    const { start, end } = preset.getRange();
    setPresetId(preset.id);
    setStartDate(toInputDate(start));
    setEndDate(toInputDate(end));
  }, []);

  useEffect(() => {
    if (!open) return;
    applyPreset(DATE_RANGE_PRESETS[0]);
    setError(null);
    setStarting(false);
  }, [open, applyPreset]);

  async function onModelSelect(provider: LlmProvider, model: string) {
    try {
      const next = await setLlmModel(provider, model);
      setLlmSettings(next);
    } catch (err) {
      console.error("Failed to save model selection", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onConfirm() {
    if (!rangeValid || starting || !llmSettings) return;
    if (!hasKey) {
      const label =
        llmSettings.providers.find((p) => p.id === llmSettings.provider)
          ?.label ?? "provider";
      setError(`Add a ${label} key in Settings first.`);
      return;
    }
    setStarting(true);
    setError(null);
    try {
      // Let React paint the loader before the IPC call can stall the UI.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const result = await startAnalysis({
        kind,
        startDate,
        endDate,
        provider: llmSettings.provider,
        model: llmSettings.model,
        composioUserId,
      });
      onStarted({
        jobId: result.jobId,
        kind,
        startDate,
        endDate,
        provider: result.provider,
        model: result.model,
      });
      onOpenChange(false);
    } catch (err) {
      setStarting(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (starting) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="rounded-none sm:max-w-lg"
        showCloseButton={!starting}
      >
        <DialogHeader>
          <DialogTitle>{starting ? loading.title : title}</DialogTitle>
          <DialogDescription>
            {starting
              ? "The app is still working — hang tight while the run starts."
              : description}
          </DialogDescription>
        </DialogHeader>

        {starting ? (
          <div className="flex items-center gap-3 border border-border bg-muted/40 px-3 py-3 text-sm text-foreground">
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <div className="min-w-0">
              <p className="font-medium">Working…</p>
              <p className="mt-0.5 text-muted-foreground">{loading.detail}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="label-caps text-muted-foreground">Suggestions</p>
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
            </div>

            <div>
              <p className="label-caps text-muted-foreground">Custom range</p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            disabled={starting}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            className="rounded-none"
            disabled={!rangeValid || starting || !llmSettings || !hasKey}
            onClick={() => void onConfirm()}
          >
            {starting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                {confirmLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
