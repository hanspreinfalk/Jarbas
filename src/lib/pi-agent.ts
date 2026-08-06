import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type PiAgentStatus =
  | { kind: "idle" }
  | { kind: "installing"; message: string }
  | { kind: "ready" }
  | { kind: "failed"; message: string };

export type PiAgentInfo = {
  status: PiAgentStatus;
  root: string;
  piCli: string;
  installed: boolean;
  node: string | null;
};

export function piAgentStatusLabel(status: PiAgentStatus): string {
  switch (status.kind) {
    case "idle":
      return "Not installed";
    case "installing":
      return status.message || "Installing…";
    case "ready":
      return "Ready";
    case "failed":
      return status.message || "Install failed";
  }
}

export async function getPiAgentStatus(): Promise<PiAgentInfo> {
  return invoke<PiAgentInfo>("get_pi_agent_status");
}

export async function ensurePiAgentInstalled(force = false): Promise<PiAgentInfo> {
  return invoke<PiAgentInfo>("ensure_pi_agent_installed", { force });
}

export async function listenPiAgentStatus(
  onStatus: (status: PiAgentStatus) => void,
): Promise<UnlistenFn> {
  return listen<PiAgentStatus>("pi-agent-status", (event) => {
    onStatus(event.payload);
  });
}
