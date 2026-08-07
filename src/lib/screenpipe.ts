import { invoke } from "@tauri-apps/api/core";
import {
  createScreenpipeTauriClient,
  type ScreenpipeTauriStartOptions,
  type ScreenpipeTauriClient,
} from "@screenpipe/sdk/tauri";

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
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Recording failed";
}
