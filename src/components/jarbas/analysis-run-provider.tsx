import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  abortAnalysis,
  emptyTranscript,
  getAnalysisStatus,
  listenAnalysisEvents,
  type AnalysisKind,
  type AnalysisRunMeta,
  type AnalysisToolCall,
  type AnalysisTranscript,
} from "@/lib/analysis";

type AnalysisRunContextValue = {
  meta: AnalysisRunMeta | null;
  transcript: AnalysisTranscript | null;
  status: string | null;
  error: string | null;
  done: boolean;
  stopping: boolean;
  live: boolean;
  startRun: (meta: AnalysisRunMeta) => void;
  stopRun: () => Promise<void>;
  clearRun: () => void;
  /** Completed ids waiting for the matching page to refresh/select. */
  completedIds: string[] | null;
  consumeCompleted: () => string[] | null;
};

const AnalysisRunContext = createContext<AnalysisRunContextValue | null>(null);

export function AnalysisRunProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<AnalysisRunMeta | null>(null);
  const [transcript, setTranscript] = useState<AnalysisTranscript | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[] | null>(null);

  const jobIdRef = useRef<string | null>(null);
  const kindRef = useRef<AnalysisKind | null>(null);

  useEffect(() => {
    jobIdRef.current = meta?.jobId ?? null;
    kindRef.current = meta?.kind ?? null;
  }, [meta]);

  // Reattach if a job is already running (e.g. after leaving the page).
  useEffect(() => {
    let cancelled = false;
    void getAnalysisStatus()
      .then((current) => {
        if (cancelled || !current.running || meta) return;
        const next: AnalysisRunMeta = {
          jobId: current.jobId,
          kind: current.kind,
          startDate: current.startDate,
          endDate: current.endDate,
          provider: current.provider,
          model: current.model,
        };
        setMeta(next);
        setTranscript(emptyTranscript(next));
        setStatus("Analyzing…");
        setError(null);
        setDone(false);
        setStopping(false);
      })
      .catch((err) => {
        console.error("Failed to read analysis status", err);
      });
    return () => {
      cancelled = true;
    };
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!meta) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void listenAnalysisEvents((event) => {
      if (cancelled) return;

      if (event.type === "started") {
        if (event.jobId !== jobIdRef.current && event.kind !== kindRef.current) {
          return;
        }
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
        setTranscript((current) =>
          current
            ? { ...current, content: `${current.content}${event.delta}` }
            : current,
        );
        return;
      }

      if (event.type === "thinkingDelta") {
        if (event.jobId !== jobIdRef.current) return;
        setTranscript((current) =>
          current
            ? { ...current, thinking: `${current.thinking}${event.delta}` }
            : current,
        );
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
        setTranscript((current) =>
          current
            ? {
                ...current,
                tools: [
                  ...current.tools.filter((tool) => tool.id !== next.id),
                  next,
                ],
              }
            : current,
        );
        return;
      }

      if (event.type === "toolEnd") {
        if (event.jobId !== jobIdRef.current) return;
        setTranscript((current) =>
          current
            ? {
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
              }
            : current,
        );
        return;
      }

      if (event.type === "completed") {
        if (event.kind !== kindRef.current) return;
        if (event.jobId !== jobIdRef.current) return;
        setDone(true);
        setStopping(false);
        setStatus(null);
        setCompletedIds(event.ids);
        setTranscript((current) =>
          current
            ? {
                ...current,
                finishedAt: Date.now(),
                tools: current.tools.map((tool) =>
                  tool.status === "running"
                    ? { ...tool, status: "done" as const }
                    : tool,
                ),
              }
            : current,
        );
        return;
      }

      if (event.type === "cancelled") {
        if (event.jobId !== jobIdRef.current) return;
        setDone(true);
        setStopping(false);
        setStatus(null);
        setError(null);
        setMeta(null);
        setTranscript(null);
        return;
      }

      if (event.type === "error") {
        if (event.jobId && event.jobId !== jobIdRef.current) return;
        setDone(true);
        setStopping(false);
        setStatus(null);
        setError(event.message);
        setTranscript((current) =>
          current ? { ...current, finishedAt: Date.now() } : current,
        );
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [meta?.jobId, meta?.kind]);

  const startRun = useCallback((next: AnalysisRunMeta) => {
    setMeta(next);
    setTranscript(emptyTranscript(next));
    setStatus("Starting analysis…");
    setError(null);
    setDone(false);
    setStopping(false);
    setCompletedIds(null);
  }, []);

  const stopRun = useCallback(async () => {
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
  }, [done, stopping]);

  const clearRun = useCallback(() => {
    setMeta(null);
    setTranscript(null);
    setStatus(null);
    setError(null);
    setDone(false);
    setStopping(false);
    setCompletedIds(null);
  }, []);

  const consumeCompleted = useCallback(() => {
    const ids = completedIds;
    setCompletedIds(null);
    return ids;
  }, [completedIds]);

  const value = useMemo<AnalysisRunContextValue>(
    () => ({
      meta,
      transcript,
      status,
      error,
      done,
      stopping,
      live: Boolean(meta) && !done,
      startRun,
      stopRun,
      clearRun,
      completedIds,
      consumeCompleted,
    }),
    [
      meta,
      transcript,
      status,
      error,
      done,
      stopping,
      startRun,
      stopRun,
      clearRun,
      completedIds,
      consumeCompleted,
    ],
  );

  return (
    <AnalysisRunContext.Provider value={value}>
      {children}
    </AnalysisRunContext.Provider>
  );
}

export function useAnalysisRun() {
  const value = useContext(AnalysisRunContext);
  if (!value) {
    throw new Error("useAnalysisRun must be used within AnalysisRunProvider");
  }
  return value;
}
