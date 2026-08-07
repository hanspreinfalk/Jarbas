import {
  redactionCategoryLabel,
  type RedactCaptureResult,
} from "@/lib/screenpipe";

export function formatRedactionTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatRedactionDurationMs(ms: number | undefined): string {
  if (!ms || ms <= 0) return "<1s";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}m ${rem}s`;
}

export function redactionRunId(run: RedactCaptureResult): string {
  return run.id || run.completedAt;
}

export function redactionCountRows(
  counts: Record<string, number> | undefined,
): Array<{ tag: string; label: string; count: number }> {
  if (!counts) return [];
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([tag, count]) => ({
      tag,
      label: redactionCategoryLabel(tag),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
