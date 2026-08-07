import { useCallback, useEffect, useState } from "react";
import { Circle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  captureErrorMessage,
  formatLastSessionLabel,
  getLastCaptureSession,
  JARBAS_CAPTURE_START,
  screenpipe,
} from "@/lib/screenpipe";

function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RecordingPage() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastSession, setLastSession] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLastSession = useCallback(async () => {
    try {
      const session = await getLastCaptureSession();
      if (session) {
        setLastSession(formatLastSessionLabel(session));
      }
    } catch {
      // Keep whatever we already show.
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await refreshLastSession();
      try {
        const status = await screenpipe.status();
        if (!alive) return;
        setRecording(Boolean(status.recording));
        if (status.recording && typeof status.elapsedMs === "number") {
          setElapsed(Math.floor(status.elapsedMs / 1000));
        }
      } catch {
        // Bridge may not be up yet; idle UI is fine.
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshLastSession]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  async function startRecording() {
    setBusy(true);
    setError(null);
    try {
      const permissions = await screenpipe.permissions({ timeoutMs: 7500 });
      if (!permissions.screen) {
        throw new Error(
          "Screen Recording permission is required. Enable it in Settings → Permissions.",
        );
      }

      await screenpipe.start(JARBAS_CAPTURE_START);
      setElapsed(0);
      setRecording(true);
    } catch (caught) {
      setError(captureErrorMessage(caught));
      setRecording(false);
    } finally {
      setBusy(false);
    }
  }

  async function endRecording() {
    setBusy(true);
    setError(null);
    try {
      await screenpipe.stop();
      setRecording(false);
      await refreshLastSession();
    } catch (caught) {
      setError(captureErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <p className="label-caps text-muted-foreground">Capture</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Recording
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        Record how you work. Capture stays private on this device.
      </p>

      <section className="mt-10 border border-border bg-card">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label-caps text-muted-foreground">Session</p>
              <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
                {recording ? "Recording how you work" : "Ready to record"}
              </p>
            </div>
            <div
              className={cn(
                "inline-flex items-center gap-2 border px-2.5 py-1 text-xs font-medium",
                recording
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-2",
                  recording ? "animate-pulse bg-destructive" : "bg-muted-foreground/50",
                )}
              />
              {recording ? "Live" : "Idle"}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center px-4 py-10 sm:px-5 sm:py-12">
          <p className="font-display text-5xl tracking-tight tabular-nums text-foreground sm:text-6xl">
            {formatElapsed(elapsed)}
          </p>
          {error ? (
            <p className="mt-4 max-w-md text-center text-sm text-destructive">{error}</p>
          ) : null}
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            {!recording ? (
              <Button
                type="button"
                size="lg"
                onClick={() => void startRecording()}
                disabled={busy}
                className="rounded-none"
              >
                <Circle className="size-3.5 fill-current" />
                {busy ? "Starting…" : "Start recording"}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => void endRecording()}
                disabled={busy}
                className="rounded-none border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Square className="size-3.5 fill-current" />
                {busy ? "Stopping…" : "End recording"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
          <div className="bg-card px-4 py-3">
            <p className="label-caps text-muted-foreground">Captures</p>
            <p className="mt-1 text-sm text-foreground">Screen · accessibility</p>
          </div>
          <div className="bg-card px-4 py-3">
            <p className="label-caps text-muted-foreground">Output</p>
            <p className="mt-1 text-sm text-foreground">On this device</p>
          </div>
          <div className="bg-card px-4 py-3">
            <p className="label-caps text-muted-foreground">Last session</p>
            <p className="mt-1 text-sm text-foreground">
              {lastSession ? lastSession : recording ? "In progress" : "None yet"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
