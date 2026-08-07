import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Square } from "lucide-react";
import { AnalysisChatPanel } from "@/components/jarbas/analysis-chat-panel";
import { Button } from "@/components/ui/button";
import {
  abortAnalysis,
  emptyTranscript,
  listenAnalysisEvents,
  type AnalysisKind,
  type AnalysisRunMeta,
  type AnalysisToolCall,
  type AnalysisTranscript,
} from "@/lib/analysis";
import { formatRangeLabel } from "@/lib/date-range";

const KIND_LABEL: Record<AnalysisKind, string> = {
  learnings: "learnings",
  opportunities: "opportunities",
  reports: "a work report",
};

export function AnalysisRunView({
  meta,
  onCompleted,
  onCancel,
  onErrorBack,
}: {
  meta: AnalysisRunMeta;
  onCompleted: (ids: string[]) => void;
  onCancel: () => void;
  onErrorBack: () => void;
}) {
  const [transcript, setTranscript] = useState<AnalysisTranscript>(() =>
    emptyTranscript(meta),
  );
  const [status, setStatus] = useState<string | null>("Starting analysis…");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [stopping, setStopping] = useState(false);
  const jobIdRef = useRef(meta.jobId);
  const onCancelRef = useRef(onCancel);
  const onCompletedRef = useRef(onCompleted);

  onCancelRef.current = onCancel;
  onCompletedRef.current = onCompleted;

  useEffect(() => {
    jobIdRef.current = meta.jobId;
    setTranscript(emptyTranscript(meta));
    setStatus("Starting analysis…");
    setError(null);
    setDone(false);
    setStopping(false);
  }, [meta]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listenAnalysisEvents((event) => {
      if (cancelled) return;

      if (event.type === "started") {
        if (event.jobId !== jobIdRef.current && event.kind !== meta.kind) return;
        jobIdRef.current = event.jobId;
        setStatus("Analyzing…");
        return;
      }

      if (event.type === "status") {
        if (event.jobId !== jobIdRef.current) return;
        setStatus(event.message);
        return;
      }

      if (event.type === "textDelta") {
        if (event.jobId !== jobIdRef.current) return;
        setTranscript((current) => ({
          ...current,
          content: `${current.content}${event.delta}`,
        }));
        return;
      }

      if (event.type === "thinkingDelta") {
        if (event.jobId !== jobIdRef.current) return;
        setTranscript((current) => ({
          ...current,
          thinking: `${current.thinking}${event.delta}`,
        }));
        return;
      }

      if (event.type === "toolStart") {
        if (event.jobId !== jobIdRef.current) return;
        const next: AnalysisToolCall = {
          id: event.toolCallId || `tool-${Date.now()}`,
          name: event.toolName,
          label: event.label,
          args: event.args,
          status: "running",
          result: "",
        };
        setTranscript((current) => ({
          ...current,
          tools: [...current.tools.filter((tool) => tool.id !== next.id), next],
        }));
        return;
      }

      if (event.type === "toolEnd") {
        if (event.jobId !== jobIdRef.current) return;
        setTranscript((current) => ({
          ...current,
          tools: current.tools.map((tool) =>
            tool.id === event.toolCallId
              ? {
                  ...tool,
                  status: event.isError ? "error" : "done",
                  result: event.result ?? "",
                }
              : tool,
          ),
        }));
        return;
      }

      if (event.type === "completed") {
        if (event.kind !== meta.kind) return;
        if (event.jobId !== jobIdRef.current) return;
        setDone(true);
        setStopping(false);
        setStatus(null);
        setTranscript((current) => ({
          ...current,
          finishedAt: Date.now(),
          tools: current.tools.map((tool) =>
            tool.status === "running"
              ? { ...tool, status: "done" as const }
              : tool,
          ),
        }));
        onCompletedRef.current(event.ids);
        return;
      }

      if (event.type === "cancelled") {
        if (event.jobId !== jobIdRef.current) return;
        setDone(true);
        setStopping(false);
        setStatus(null);
        setError(null);
        onCancelRef.current();
        return;
      }

      if (event.type === "error") {
        if (event.jobId && event.jobId !== jobIdRef.current) return;
        setDone(true);
        setStopping(false);
        setStatus(null);
        setError(event.message);
        setTranscript((current) => ({
          ...current,
          finishedAt: Date.now(),
        }));
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [meta.kind]);

  async function handleStop() {
    if (stopping || done) return;
    setStopping(true);
    setStatus("Stopping…");
    try {
      await abortAnalysis();
    } catch (err) {
      console.error("Failed to stop analysis", err);
      setStopping(false);
      setError(err instanceof Error ? err.message : String(err));
      setDone(true);
    }
  }

  const promptLabel = `Capture ${KIND_LABEL[meta.kind]} for ${formatRangeLabel(meta.startDate, meta.endDate)}.`;
  const live = !done;

  return (
    <div className="animate-rise flex min-h-[calc(100dvh-5rem)] flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="label-caps text-muted-foreground">
              {live ? "Analyzing" : error ? "Stopped" : "Done"}
            </p>
            <h1 className="truncate font-display text-xl tracking-tight text-foreground sm:text-2xl">
              {formatRangeLabel(meta.startDate, meta.endDate)}
            </h1>
          </div>
          {live ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={stopping}
              onClick={() => void handleStop()}
            >
              <Square className="size-3 fill-current" />
              {stopping ? "Stopping…" : "Stop"}
            </Button>
          ) : error ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              onClick={onErrorBack}
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        <AnalysisChatPanel
          transcript={transcript}
          live={live}
          status={status}
          error={error}
          promptLabel={promptLabel}
        />
      </div>

      {live ? (
        <div className="sticky bottom-0 shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-muted-foreground">
              {stopping ? "Stopping analysis…" : status || "Analysis running…"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none"
              disabled={stopping}
              onClick={() => void handleStop()}
            >
              <Square className="size-3 fill-current" />
              {stopping ? "Stopping…" : "Stop"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
