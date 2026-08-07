import { invoke } from "@tauri-apps/api/core";

export async function openPrivacySettings(pane: string) {
  try {
    await invoke("open_privacy_settings", { pane });
  } catch (error) {
    console.error("Failed to open privacy settings", error);
  }
}

export async function checkAccessibilityPermission(): Promise<boolean> {
  try {
    const result = await invoke<{ granted: boolean }>(
      "check_accessibility_permission",
    );
    return Boolean(result?.granted);
  } catch (error) {
    console.error("Failed to check accessibility permission", error);
    return false;
  }
}
