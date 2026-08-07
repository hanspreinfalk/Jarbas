import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRangeLabel } from "@/lib/date-range";
import { thisComputerPhrase } from "@/lib/platform";
import {
  formatRedactionDurationMs,
  formatRedactionTimestamp,
  redactionCountRows,
  redactionRunId,
} from "@/lib/redaction-ui";
import {
  getLastRedaction,
  getRedactionHistory,
  type RedactCaptureResult,
} from "@/lib/screenpipe";
import type { AppTabId } from "@/lib/app-tabs";

export function RedactionsPage({
  onNavigate,
}: {
  onNavigate: (id: AppTabId) => void;
}) {
  const [runs, setRuns] = useState<RedactCaptureResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RedactCaptureResult | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const history = await getRedactionHistory();
      setRuns(history);
    } catch {
      try {
        const last = await getLastRedaction();
        setRuns(last ? [last] : []);
      } catch {
        setRuns([]);
        setLoadError("Could not load redaction history.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="animate-rise mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate("settings")}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Settings
      </button>

      <p className="label-caps mt-4 text-muted-foreground">Privacy</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Redactions
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        Every redaction pass saved on {thisComputerPhrase()}, newest first.
        Open a run for full details.
      </p>

      <section className="mt-8 border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              History
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : runs.length === 0
                  ? "No runs yet"
                  : `${runs.length} run${runs.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none"
            disabled={loading}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading redactions…
          </div>
        ) : loadError ? (
          <p className="px-4 py-6 text-sm text-destructive">{loadError}</p>
        ) : runs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No redaction runs saved yet. Use Redact in Settings, or keep
            auto-redact on when you end a recording.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {runs.map((run) => {
              const runId = redactionRunId(run);
              return (
                <li key={runId}>
                  <button
                    type="button"
                    onClick={() => setSelected(run)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {formatRedactionTimestamp(run.completedAt)}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {run.startDate && run.endDate
                          ? formatRangeLabel(run.startDate, run.endDate)
                          : "Range unknown"}
                        {" · "}
                        {new Intl.NumberFormat(undefined).format(
                          run.totalMatches ?? 0,
                        )}{" "}
                        matches
                        {" · "}
                        {formatRedactionDurationMs(run.durationMs)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Redaction details</DialogTitle>
            <DialogDescription>
              {selected
                ? formatRedactionTimestamp(selected.completedAt)
                : "Details for this redaction pass."}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">{selected.message}</p>
              <div className="grid grid-cols-2 gap-px border border-border bg-border">
                <div className="bg-card px-3 py-3">
                  <p className="label-caps text-muted-foreground">Started</p>
                  <p className="mt-1 text-sm text-foreground">
                    {selected.startedAt
                      ? formatRedactionTimestamp(selected.startedAt)
                      : "—"}
                  </p>
                </div>
                <div className="bg-card px-3 py-3">
                  <p className="label-caps text-muted-foreground">Finished</p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatRedactionTimestamp(selected.completedAt)}
                  </p>
                </div>
                <div className="bg-card px-3 py-3">
                  <p className="label-caps text-muted-foreground">Range</p>
                  <p className="mt-1 text-sm text-foreground">
                    {selected.startDate && selected.endDate
                      ? formatRangeLabel(selected.startDate, selected.endDate)
                      : "—"}
                  </p>
                </div>
                <div className="bg-card px-3 py-3">
                  <p className="label-caps text-muted-foreground">Duration</p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatRedactionDurationMs(selected.durationMs)}
                  </p>
                </div>
                <div className="bg-card px-3 py-3">
                  <p className="label-caps text-muted-foreground">Matches</p>
                  <p className="mt-1 text-sm text-foreground">
                    {new Intl.NumberFormat(undefined).format(
                      selected.totalMatches ?? 0,
                    )}
                  </p>
                </div>
                <div className="bg-card px-3 py-3">
                  <p className="label-caps text-muted-foreground">
                    Fields scanned
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {new Intl.NumberFormat(undefined).format(
                      selected.scannedRows,
                    )}
                  </p>
                </div>
                <div className="col-span-2 bg-card px-3 py-3">
                  <p className="label-caps text-muted-foreground">
                    Fields updated
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {new Intl.NumberFormat(undefined).format(
                      selected.updatedRows,
                    )}
                  </p>
                </div>
              </div>

              <div>
                <p className="label-caps text-muted-foreground">By category</p>
                {redactionCountRows(selected.counts).length > 0 ? (
                  <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto border border-border">
                    {redactionCountRows(selected.counts).map((row) => (
                      <li
                        key={row.tag}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span className="text-foreground">{row.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {new Intl.NumberFormat(undefined).format(row.count)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    No category matches were recorded for this pass.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => setSelected(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
