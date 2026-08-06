import { useEffect, useState } from "react";
import { Circle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  function startRecording() {
    setElapsed(0);
    setRecording(true);
  }

  function endRecording() {
    setLastSession(formatElapsed(elapsed));
    setRecording(false);
  }

  return (
    <div className="animate-rise mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <p className="label-caps text-muted-foreground">Capture</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Recording / Ask
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        Record how you work.
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
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            {!recording ? (
              <Button
                type="button"
                size="lg"
                onClick={startRecording}
                className="rounded-none"
              >
                <Circle className="size-3.5 fill-current" />
                Start recording
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={endRecording}
                className="rounded-none border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Square className="size-3.5 fill-current" />
                End recording
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
          <div className="bg-card px-4 py-3">
            <p className="label-caps text-muted-foreground">Captures</p>
            <p className="mt-1 text-sm text-foreground">Screen · workflow context</p>
          </div>
          <div className="bg-card px-4 py-3">
            <p className="label-caps text-muted-foreground">Purpose</p>
            <p className="mt-1 text-sm text-foreground">Learn how you work</p>
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
