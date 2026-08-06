import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type AskEvent =
  | { type: "agentStart" }
  | { type: "agentSettled" }
  | { type: "textDelta"; delta: string }
  | { type: "thinkingDelta"; delta: string }
  | {
      type: "toolStart";
      toolCallId: string;
      toolName: string;
      label: string;
      args: unknown;
    }
  | {
      type: "toolUpdate";
      toolCallId: string;
      toolName: string;
      label: string;
      partialResult: string;
    }
  | {
      type: "toolEnd";
      toolCallId: string;
      toolName: string;
      label: string;
      isError: boolean;
      result: string;
    }
  | { type: "error"; message: string };

export async function askSendPrompt(message: string): Promise<void> {
  await invoke("ask_send_prompt", { message });
}

export async function askAbort(): Promise<void> {
  await invoke("ask_abort");
}

export async function askNewSession(): Promise<void> {
  await invoke("ask_new_session");
}

export async function listenAskEvents(
  onEvent: (event: AskEvent) => void,
): Promise<UnlistenFn> {
  return listen<AskEvent>("ask-event", (event) => {
    onEvent(event.payload);
  });
}
