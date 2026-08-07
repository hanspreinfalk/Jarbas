import { invoke } from "@tauri-apps/api/core";

export async function openPrivacySettings(pane: string) {
  try {
    await invoke("open_privacy_settings", { pane });
  } catch (error) {
    console.error("Failed to open privacy settings", error);
  }
}

export type AccessibilityPermissionStatus = {
  granted: boolean;
  executablePath?: string | null;
  processName?: string | null;
};

export async function checkAccessibilityPermission(): Promise<boolean> {
  const status = await getAccessibilityPermissionStatus();
  return status.granted;
}

export async function getAccessibilityPermissionStatus(): Promise<AccessibilityPermissionStatus> {
  try {
    return await invoke<AccessibilityPermissionStatus>(
      "check_accessibility_permission",
    );
  } catch (error) {
    console.error("Failed to check accessibility permission", error);
    return { granted: false };
  }
}
