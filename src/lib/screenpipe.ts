import { invoke } from "@tauri-apps/api/core";
import {
  createScreenpipeTauriClient,
  type ScreenpipeTauriStartOptions,
  type ScreenpipeTauriClient,
} from "@screenpipe/sdk/tauri";
import {
  ALL_REDACTION_TAGS,
  REDACTION_CATEGORY_OPTIONS,
  REDACTION_SECRETS_TAGS,
  redactionCategoryLabel,
} from "@/lib/redaction-categories";

/** Thin Jarbas host binding for `@screenpipe/sdk`. Videos land in ~/.jarbas/videos. */
export const screenpipe: ScreenpipeTauriClient = createScreenpipeTauriClient({
  appName: "jarbas",
  telemetry: false,
  commands: {
    permissions: "screenpipe_permissions",
    start: "screenpipe_start",
    stop: "screenpipe_stop",
    status: "screenpipe_status",
    snapshot: "screenpipe_snapshot",
    reveal: "screenpipe_reveal",
    dispose: "screenpipe_dispose",
    events: "screenpipe_events",
    identify: "screenpipe_identify",
  },
});

/** Start options: `dataDir` / `outputDir` are forced on the Rust side. */
export const JARBAS_CAPTURE_START: ScreenpipeTauriStartOptions = {
  filenamePrefix: "jarbas",
  uiCapture: {
    captureClicks: true,
    captureText: true,
    captureAppSwitch: true,
    captureClipboard: true,
    captureContext: true,
    captureWindowFocus: true,
    captureScroll: true,
  },
};

export type LastCaptureSession = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  frameCount: number;
};

export async function getLastCaptureSession(): Promise<LastCaptureSession | null> {
  return invoke<LastCaptureSession | null>("capture_last_session");
}

export type CaptureStorageStats = {
  root: string;
  bytes: number;
  frames: number;
};

export async function getCaptureStorageStats(): Promise<CaptureStorageStats> {
  return invoke<CaptureStorageStats>("capture_storage_stats");
}

export type ResetJarbasMode = "full" | "range";

export type ResetJarbasResult = {
  mode: ResetJarbasMode | string;
  deletedVideos: number;
  deletedFrames: number;
  deletedSnapshotDirs: number;
  deletedAnalysisItems: number;
  deletedAnalysisRuns: number;
  message: string;
};

export async function resetJarbasData(options: {
  mode: ResetJarbasMode;
  startDate?: string;
  endDate?: string;
}): Promise<ResetJarbasResult> {
  return invoke<ResetJarbasResult>("reset_jarbas_data", {
    mode: options.mode,
    startDate: options.startDate ?? null,
    endDate: options.endDate ?? null,
  });
}

export type RedactCaptureResult = {
  id?: string;
  scannedRows: number;
  updatedRows: number;
  message: string;
  startDate?: string;
  endDate?: string;
  startedAt?: string;
  completedAt: string;
  durationMs?: number;
  totalMatches?: number;
  counts?: Record<string, number>;
};

export {
  ALL_REDACTION_TAGS,
  REDACTION_CATEGORY_OPTIONS,
  REDACTION_SECRETS_TAGS,
  redactionCategoryLabel,
};

/** Scrub emails, keys, passwords, cards, etc. from stored capture text. */
export async function redactJarbasCapture(options: {
  startDate: string;
  endDate: string;
  /** When true, return match counts without writing. */
  dryRun?: boolean;
}): Promise<RedactCaptureResult> {
  return invoke<RedactCaptureResult>("redact_jarbas_capture", {
    startDate: options.startDate,
    endDate: options.endDate,
    dryRun: options.dryRun ?? false,
  });
}

/** Last persisted redaction pass, if any. */
export async function getLastRedaction(): Promise<RedactCaptureResult | null> {
  return invoke<RedactCaptureResult | null>("get_last_redaction");
}

/** Every stored redaction pass, newest first. */
export async function getRedactionHistory(): Promise<RedactCaptureResult[]> {
  return invoke<RedactCaptureResult[]>("get_redaction_history");
}

export type RedactionPrefs = {
  autoRedactOnStop: boolean;
  enabledCategories: string[];
};

/** Auto-redact preference (defaults to on when unset). */
export async function getRedactionPrefs(): Promise<RedactionPrefs> {
  return invoke<RedactionPrefs>("get_redaction_prefs");
}

/** Persist whether End Recording should auto-redact the just-finished session. */
export async function setAutoRedactOnStop(
  enabled: boolean,
): Promise<RedactionPrefs> {
  return invoke<RedactionPrefs>("set_auto_redact_on_stop", { enabled });
}

/** Persist which PII / secret category tags are enabled for scrubbing. */
export async function setEnabledRedactionCategories(
  categories: string[],
): Promise<RedactionPrefs> {
  return invoke<RedactionPrefs>("set_enabled_redaction_categories", {
    categories,
  });
}

export type CaptureFilters = {
  ignoredWindows: string[];
  ignoredUrls: string[];
};

/** Apps/windows/URLs skipped while focused (no frames/OCR/UI stored). */
export async function getCaptureFilters(): Promise<CaptureFilters> {
  return invoke<CaptureFilters>("get_capture_filters");
}

/** Persist ignored app/window and URL patterns for the next recording. */
export async function setCaptureFilters(options: {
  ignoredWindows: string[];
  ignoredUrls: string[];
}): Promise<CaptureFilters> {
  return invoke<CaptureFilters>("set_capture_filters", {
    ignoredWindows: options.ignoredWindows,
    ignoredUrls: options.ignoredUrls,
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)}${units[unit]}`;
}

export function formatFrameCount(frames: number): string {
  return new Intl.NumberFormat(undefined).format(Math.max(0, Math.floor(frames)));
}

export function formatLastSessionLabel(session: LastCaptureSession): string {
  const ended = new Date(session.endedAt);
  if (Number.isNaN(ended.getTime())) {
    return formatDurationMs(session.durationMs);
  }

  const now = new Date();
  const sameDay =
    ended.getFullYear() === now.getFullYear() &&
    ended.getMonth() === now.getMonth() &&
    ended.getDate() === now.getDate();

  const time = ended.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const duration = formatDurationMs(session.durationMs);

  if (sameDay) {
    return `${time} · ${duration}`;
  }

  const day = ended.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  return `${day} · ${time} · ${duration}`;
}

function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function captureErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string" && error.trim()
        ? error
        : "";
  if (/not allowed by ACL/i.test(raw)) {
    return "Capture is blocked by app security settings. Quit and reopen Jarbas (rebuild the app if this persists).";
  }
  if (raw) return raw;
  return "Recording failed";
}
