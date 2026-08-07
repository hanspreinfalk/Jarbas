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
      return "Windows permissions for capture.";
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
      return "in Windows privacy settings";
    default:
      return "in your system privacy settings";
  }
}
