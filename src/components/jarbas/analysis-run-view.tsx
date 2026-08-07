import { ArrowLeft, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { AnalysisChatPanel } from "@/components/jarbas/analysis-chat-panel";
import { useAnalysisRun } from "@/components/jarbas/analysis-run-provider";
import { Button } from "@/components/ui/button";
import { formatRangeLabel } from "@/lib/date-range";
import {
  friendlyKindVerb,
  friendlyPromptLabel,
} from "@/lib/friendly-analysis";

export function AnalysisRunView({
  onCompleted,
  onErrorBack,
}: {
  onCompleted: (result: { ids: string[]; items: unknown[] | null }) => void;
  onErrorBack: () => void;
}) {
  const {
    meta,
    transcript,
    status,
    error,
    done,
    stopping,
    live,
    stopRun,
    clearRun,
    completedIds,
    consumeCompleted,
  } = useAnalysisRun();

  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  useEffect(() => {
    if (!done || error || !completedIds) return;
    const result = consumeCompleted();
    if (result) onCompletedRef.current(result);
  }, [done, error, completedIds, consumeCompleted]);

  if (!meta || !transcript) return null;

  const rangeLabel = formatRangeLabel(meta.startDate, meta.endDate);
  const promptLabel = friendlyPromptLabel(meta.kind, rangeLabel);
  const verb = friendlyKindVerb(meta.kind);

  return (
    <div className="animate-rise flex min-h-[calc(100dvh-5rem)] flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps text-muted-foreground">
              {live ? verb : error ? "Stopped" : "Done"}
            </p>
            <h1 className="truncate font-display text-xl tracking-tight text-foreground sm:text-2xl">
              {rangeLabel}
            </h1>
          </div>
          {live ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={stopping}
              onClick={() => void stopRun()}
            >
              <Square className="size-3 fill-current" />
              {stopping ? "Stopping…" : "Stop"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              onClick={() => {
                clearRun();
                onErrorBack();
              }}
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnalysisChatPanel
          transcript={transcript}
          live={live}
          status={status}
          error={error}
          promptLabel={promptLabel}
          stopping={stopping}
        />
      </div>
    </div>
  );
}
