import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type AnalysisKind =
  | "insights"
  | "opportunities"
  | "reports"
  | "team-reports";

export type AnalysisToolCall = {
  id: string;
  name: string;
  label: string;
  args: unknown;
  status: "running" | "done" | "error";
  result: string;
};

export type AnalysisTranscript = {
  jobId: string;
  kind?: AnalysisKind;
  startDate?: string;
  endDate?: string;
  provider?: string;
  model?: string;
  content: string;
  thinking: string;
  tools: AnalysisToolCall[];
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
};

export type AnalysisEvent =
  | { type: "started"; jobId: string; kind: AnalysisKind }
  | { type: "status"; jobId: string; message: string }
  | { type: "textDelta"; jobId: string; delta: string }
  | { type: "thinkingDelta"; jobId: string; delta: string }
  | {
      type: "toolStart";
      jobId: string;
      toolCallId: string;
      toolName: string;
      label: string;
      args: unknown;
    }
  | {
      type: "toolEnd";
      jobId: string;
      toolCallId: string;
      toolName: string;
      label: string;
      isError: boolean;
      result: string;
    }
  | { type: "completed"; jobId: string; kind: AnalysisKind; ids: string[]; items?: unknown[] }
  | { type: "cancelled"; jobId: string }
  | { type: "error"; jobId?: string | null; message: string };

export type AnalysisStatus =
  | { running: false }
  | {
      running: true;
      jobId: string;
      kind: AnalysisKind;
      startDate: string;
      endDate: string;
      provider: string;
      model: string;
    };

export type RecoverFinishedAnalysisResult =
  | {
      running: false;
      recovered: true;
      jobId: string;
      kind: AnalysisKind;
      ids: string[];
      items?: unknown[] | null;
    }
  | {
      running: false;
      recovered: false;
      error?: string;
    }
  | { running: true };

export type StartAnalysisResult = {
  jobId: string;
  kind: AnalysisKind;
  provider: string;
  model: string;
  composioAttached?: boolean;
  connectedToolkits?: string[];
};

export type AnalysisRunMeta = {
  jobId: string;
  kind: AnalysisKind;
  startDate: string;
  endDate: string;
  provider: string;
  model: string;
};

function userLocalTimeContext(): { timeZone: string; localTime: string } {
  const now = new Date();
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const localTime = now.toLocaleString(undefined, {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
  return { timeZone, localTime };
}

export async function listAnalysisItems<T>(kind: AnalysisKind): Promise<T[]> {
  return invoke<T[]>("list_analysis_items", { kind });
}

export async function deleteAnalysisItem(
  kind: AnalysisKind,
  id: string,
): Promise<void> {
  await invoke("delete_analysis_item", { kind, id });
}

export async function updateAnalysisItem<T>(
  kind: AnalysisKind,
  id: string,
  item: T,
): Promise<T> {
  return invoke<T>("update_analysis_item", { kind, id, item });
}

export async function getAnalysisStatus(): Promise<AnalysisStatus> {
  return invoke<AnalysisStatus>("get_analysis_status");
}

export async function recoverFinishedAnalysis(
  jobId: string,
): Promise<RecoverFinishedAnalysisResult> {
  return invoke<RecoverFinishedAnalysisResult>("recover_finished_analysis", {
    jobId,
  });
}

export async function startAnalysis(options: {
  kind: AnalysisKind;
  startDate: string;
  endDate: string;
  provider?: string;
  model?: string;
  composioUserId?: string | null;
  /** Member report payloads for team-reports synthesis (Convex docs / WorkReport JSON). */
  memberReports?: unknown[] | null;
}): Promise<StartAnalysisResult> {
  const { timeZone, localTime } = userLocalTimeContext();
  return invoke<StartAnalysisResult>("start_analysis", {
    kind: options.kind,
    startDate: options.startDate,
    endDate: options.endDate,
    timeZone,
    localTime,
    provider: options.provider ?? null,
    model: options.model ?? null,
    composioUserId: options.composioUserId ?? null,
    memberReports: options.memberReports ?? null,
  });
}

export async function abortAnalysis(jobId?: string | null): Promise<void> {
  await invoke("abort_analysis", { jobId: jobId ?? null });
}

export async function listenAnalysisEvents(
  onEvent: (event: AnalysisEvent) => void,
): Promise<UnlistenFn> {
  return listen<AnalysisEvent>("analysis-event", (event) => {
    onEvent(event.payload);
  });
}

export function emptyTranscript(meta: AnalysisRunMeta): AnalysisTranscript {
  return {
    jobId: meta.jobId,
    kind: meta.kind,
    startDate: meta.startDate,
    endDate: meta.endDate,
    provider: meta.provider,
    model: meta.model,
    content: "",
    thinking: "",
    tools: [],
    startedAt: Date.now(),
  };
}
