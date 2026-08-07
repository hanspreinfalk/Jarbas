import { invoke } from "@tauri-apps/api/core";
import { detectHostOs } from "@/lib/platform";
import { screenpipe } from "@/lib/screenpipe";

export async function openPrivacySettings(pane: string) {
  await invoke("open_privacy_settings", { pane });
}

export type AccessibilityPermissionStatus = {
  granted: boolean;
  executablePath?: string | null;
  processName?: string | null;
};

export type ScreenPermissionStatus = {
  granted: boolean;
};

export type CapturePermissionSnapshot = {
  screen: boolean;
  accessibility: boolean;
  accessibilityInfo: AccessibilityPermissionStatus;
};

export async function checkAccessibilityPermission(): Promise<boolean> {
  const status = await getAccessibilityPermissionStatus();
  return status.granted;
}

export async function getAccessibilityPermissionStatus(options?: {
  prompt?: boolean;
}): Promise<AccessibilityPermissionStatus> {
  try {
    return await invoke<AccessibilityPermissionStatus>(
      "check_accessibility_permission",
      { prompt: options?.prompt ?? false },
    );
  } catch (error) {
    console.error("Failed to check accessibility permission", error);
    return { granted: false };
  }
}

export async function getScreenPermissionStatus(): Promise<ScreenPermissionStatus> {
  try {
    return await invoke<ScreenPermissionStatus>("check_screen_permission");
  } catch (error) {
    console.error("Failed to check screen permission", error);
    return { granted: false };
  }
}

/**
 * Authoritative capture permission snapshot for UI badges.
 * Never reports "Granted" without positive evidence.
 */
export async function getCapturePermissionSnapshot(): Promise<CapturePermissionSnapshot> {
  const [osScreen, accessibilityInfo, bridge] = await Promise.all([
    getScreenPermissionStatus(),
    getAccessibilityPermissionStatus(),
    screenpipe
      .permissions({ timeoutMs: 7500 })
      .then((status) => ({
        screen: Boolean(status.screen),
      }))
      .catch(() => null as { screen: boolean } | null),
  ]);

  const os = detectHostOs();
  let screen = false;

  if (os === "macos") {
    // CGPreflightScreenCaptureAccess for THIS process is the source of truth.
    screen = osScreen.granted === true;
  } else if (os === "windows") {
    // No Win32 TCC preflight for unpackaged apps — require capture-bridge evidence.
    screen = bridge?.screen === true;
  } else {
    screen = bridge?.screen === true;
  }

  return {
    screen,
    accessibility: accessibilityInfo.granted === true,
    accessibilityInfo,
  };
}
