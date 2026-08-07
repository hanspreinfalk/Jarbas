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

const REDACTION_CATEGORY_LABELS: Record<string, string> = {
  EMAIL: "Emails",
  PASSWORD: "Passwords",
  PASSWORD_DOTS: "Password dots",
  PASSWORD_FIELD: "Password fields",
  PHONE: "Phone numbers",
  CREDIT_CARD: "Credit cards",
  SSN: "SSNs",
  IP_ADDRESS: "IP addresses",
  JWT_TOKEN: "JWT tokens",
  PRIVATE_KEY: "Private keys",
  CONNECTION_STRING: "Connection strings",
  URL_WITH_CREDENTIALS: "URLs with credentials",
  STRIPE_KEY: "Stripe keys",
  ANTHROPIC_KEY: "Anthropic keys",
  OPENAI_KEY: "OpenAI keys",
  GOOGLE_API_KEY: "Google API keys",
  HUGGINGFACE_TOKEN: "Hugging Face tokens",
  GITHUB_TOKEN: "GitHub tokens",
  CLOUDFLARE_TOKEN: "Cloudflare tokens",
  SUPABASE_KEY: "Supabase keys",
  SLACK_TOKEN: "Slack tokens",
  DISCORD_TOKEN: "Discord tokens",
  GITLAB_TOKEN: "GitLab tokens",
  NPM_TOKEN: "npm tokens",
  PYPI_TOKEN: "PyPI tokens",
  DIGITALOCEAN_TOKEN: "DigitalOcean tokens",
  TELEGRAM_TOKEN: "Telegram tokens",
  TWILIO_KEY: "Twilio keys",
  SENDGRID_KEY: "SendGrid keys",
  MAILCHIMP_KEY: "Mailchimp keys",
  AWS_KEY: "AWS access keys",
  AWS_SECRET: "AWS secrets",
  AZURE_KEY: "Azure keys",
  API_KEY: "API keys",
  AUTH_TOKEN: "Auth tokens",
  ENV_SECRET: "Env secrets",
  IBAN: "IBANs",
  SEED_PHRASE: "Seed phrases",
  BACKUP_CODE: "Backup codes",
};

export function redactionCategoryLabel(tag: string): string {
  return (
    REDACTION_CATEGORY_LABELS[tag] ??
    tag.replace(/_/g, " ").toLowerCase()
  );
}

/** Scrub emails, keys, passwords, cards, etc. from stored capture text. */
export async function redactJarbasCapture(options: {
  startDate: string;
  endDate: string;
}): Promise<RedactCaptureResult> {
  return invoke<RedactCaptureResult>("redact_jarbas_capture", {
    startDate: options.startDate,
    endDate: options.endDate,
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
