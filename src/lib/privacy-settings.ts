import { invoke } from "@tauri-apps/api/core";

export async function openPrivacySettings(pane: string) {
  try {
    await invoke("open_privacy_settings", { pane });
  } catch (error) {
    console.error("Failed to open privacy settings", error);
  }
}
