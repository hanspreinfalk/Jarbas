/** Host OS for user-facing copy (Tauri webview). */
export type HostOs = "macos" | "windows" | "linux" | "unknown";

export function detectHostOs(): HostOs {
  if (typeof navigator === "undefined") return "unknown";

  const platform = (navigator.platform || "").toLowerCase();
  const ua = navigator.userAgent.toLowerCase();

  if (platform.includes("mac") || ua.includes("mac os") || ua.includes("macintosh")) {
    return "macos";
  }
  if (platform.includes("win") || ua.includes("windows")) {
    return "windows";
  }
  if (platform.includes("linux") || ua.includes("linux")) {
    return "linux";
  }
  return "unknown";
}

/** "this Mac" / "this PC" / "this computer" */
export function thisComputerPhrase(): string {
  switch (detectHostOs()) {
    case "macos":
      return "this Mac";
    case "windows":
      return "this PC";
    default:
      return "this computer";
  }
}

/** Short line under system permissions. */
export function capturePermissionsBlurb(): string {
  switch (detectHostOs()) {
    case "macos":
      return "macOS permissions for capture.";
    case "windows":
      return "Windows privacy settings for capture.";
    default:
      return "System permissions for capture.";
  }
}

/** Where to enable accessibility / capture access. */
export function accessibilitySettingsHint(): string {
  switch (detectHostOs()) {
    case "macos":
      return "in System Settings → Privacy & Security → Accessibility";
    case "windows":
      return "in Settings → Privacy & security (UI Automation needs no extra toggle on desktop apps)";
    default:
      return "in your system privacy settings";
  }
}

export function screenSettingsHint(): string {
  switch (detectHostOs()) {
    case "macos":
      return "in System Settings → Privacy & Security → Screen Recording";
    case "windows":
      return "in Settings → Privacy & security → Screenshots and screen recording";
    default:
      return "in your system privacy settings";
  }
}

export type CapturePermissionDef = {
  id: "screen-recording" | "accessibility";
  label: string;
  description: string;
  pane: "screen-recording" | "accessibility";
  /** When false, Windows/Linux treat this as always granted (no OS toggle). */
  requiredOnHost: boolean;
};

/** Permission rows for onboarding + Settings, adapted per OS. */
export function capturePermissionDefs(): CapturePermissionDef[] {
  const os = detectHostOs();
  const isMac = os === "macos";

  return [
    {
      id: "screen-recording",
      label: isMac ? "Screen Recording" : "Screen capture",
      description: isMac
        ? "Capture what is on screen."
        : "Capture what is on screen (Windows privacy → Screenshots and screen recording).",
      pane: "screen-recording",
      requiredOnHost: true,
    },
    {
      id: "accessibility",
      label: isMac ? "Accessibility" : "UI context",
      description: isMac
        ? "Read UI and app context."
        : "Read UI and app context. Desktop apps do not need a separate Accessibility toggle.",
      pane: "accessibility",
      requiredOnHost: isMac,
    },
  ];
}
