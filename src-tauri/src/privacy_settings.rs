//! Open OS privacy panes and report capture-related permission status.
//!
//! macOS: System Settings → Privacy & Security (Screen Recording / Accessibility).
//! Windows: Settings → Privacy (graphics capture). Desktop apps do not need a
//! separate Accessibility TCC gate like macOS.

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessibilityPermissionStatus {
    pub granted: bool,
    pub executable_path: Option<String>,
    pub process_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenPermissionStatus {
    pub granted: bool,
}

fn current_process_identity() -> (Option<String>, Option<String>) {
    let executable_path = std::env::current_exe()
        .ok()
        .map(|path| path.display().to_string());
    let process_name = executable_path.as_ref().map(|path| {
        std::path::Path::new(path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("jarbas")
            .to_string()
    });
    (executable_path, process_name)
}

#[tauri::command]
pub fn open_privacy_settings(pane: String) -> Result<(), String> {
    match pane.as_str() {
        "screen-recording" | "accessibility" => {}
        _ => return Err(format!("Unknown privacy pane: {pane}")),
    }

    #[cfg(target_os = "macos")]
    {
        return open_privacy_settings_macos(&pane);
    }

    #[cfg(target_os = "windows")]
    {
        return open_privacy_settings_windows(&pane);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = pane;
        Err("Privacy settings redirect is only available on macOS and Windows".into())
    }
}

#[cfg(target_os = "macos")]
fn open_privacy_settings_macos(pane: &str) -> Result<(), String> {
    // Prefer the current Privacy & Security extension id (macOS Ventura+ / Tahoe).
    // Legacy `com.apple.preference.security` still resolves, but often lands on the
    // wrong place on macOS 26. Screen Recording is also exposed as AudioCapture.
    let urls: &[&str] = match pane {
        "screen-recording" => &[
            "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_ScreenCapture",
            "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AudioCapture",
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
        ],
        "accessibility" => &[
            "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility",
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        ],
        _ => unreachable!(),
    };

    if pane == "screen-recording" {
        #[link(name = "CoreGraphics", kind = "framework")]
        extern "C" {
            fn CGRequestScreenCaptureAccess() -> bool;
        }
        let _ = unsafe { CGRequestScreenCaptureAccess() };
    }

    let mut last_error: Option<String> = None;
    for url in urls {
        match std::process::Command::new("/usr/bin/open")
            .arg("-u")
            .arg(url)
            .status()
        {
            Ok(status) if status.success() => return Ok(()),
            Ok(status) => {
                last_error = Some(format!("open -u {url} exited with status {status}"));
            }
            Err(error) => last_error = Some(error.to_string()),
        }
    }

    match std::process::Command::new("/usr/bin/open")
        .args(["-b", "com.apple.systempreferences"])
        .status()
    {
        Ok(status) if status.success() => Ok(()),
        Ok(status) => Err(last_error
            .unwrap_or_else(|| format!("Could not open System Settings (exit {status})"))),
        Err(error) => Err(last_error.unwrap_or_else(|| error.to_string())),
    }
}

#[cfg(target_os = "windows")]
fn open_privacy_settings_windows(pane: &str) -> Result<(), String> {
    // https://learn.microsoft.com/windows/apps/develop/launch/launch-settings
    let uris: &[&str] = match pane {
        "screen-recording" => &[
            "ms-settings:privacy-graphicscaptureprogrammatic",
            "ms-settings:privacy-graphicscapturewithoutborder",
            "ms-settings:privacy",
        ],
        "accessibility" => &[
            // No macOS-style Accessibility TCC on desktop Win32; send users to
            // Ease of Access / Privacy as the closest useful destination.
            "ms-settings:easeofaccess-display",
            "ms-settings:privacy",
        ],
        _ => unreachable!(),
    };

    let mut last_error: Option<String> = None;
    for uri in uris {
        // `start` treats the first quoted arg as a window title; pass an empty one.
        match std::process::Command::new("cmd")
            .args(["/C", "start", "", uri])
            .status()
        {
            Ok(status) if status.success() => return Ok(()),
            Ok(status) => {
                last_error = Some(format!("start {uri} exited with status {status}"));
            }
            Err(error) => last_error = Some(error.to_string()),
        }
    }

    match std::process::Command::new("cmd")
        .args(["/C", "start", "", "ms-settings:"])
        .status()
    {
        Ok(status) if status.success() => Ok(()),
        Ok(status) => Err(last_error
            .unwrap_or_else(|| format!("Could not open Windows Settings (exit {status})"))),
        Err(error) => Err(last_error.unwrap_or_else(|| error.to_string())),
    }
}

#[tauri::command]
pub fn check_accessibility_permission(prompt: Option<bool>) -> AccessibilityPermissionStatus {
    let (executable_path, process_name) = current_process_identity();

    #[cfg(target_os = "macos")]
    {
        // macOS `Boolean` is a C unsigned char, not a Rust `bool`.
        #[link(name = "ApplicationServices", kind = "framework")]
        extern "C" {
            static kAXTrustedCheckOptionPrompt: *const std::ffi::c_void;
            fn AXIsProcessTrusted() -> u8;
            fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> u8;
        }

        #[link(name = "CoreFoundation", kind = "framework")]
        extern "C" {
            fn CFDictionaryCreate(
                allocator: *const std::ffi::c_void,
                keys: *const *const std::ffi::c_void,
                values: *const *const std::ffi::c_void,
                num_values: isize,
                key_call_backs: *const std::ffi::c_void,
                value_call_backs: *const std::ffi::c_void,
            ) -> *const std::ffi::c_void;
            fn CFRelease(cf: *const std::ffi::c_void);
            static kCFBooleanTrue: *const std::ffi::c_void;
            static kCFTypeDictionaryKeyCallBacks: std::ffi::c_void;
            static kCFTypeDictionaryValueCallBacks: std::ffi::c_void;
        }

        let should_prompt = prompt.unwrap_or(false);
        let granted = unsafe {
            if should_prompt {
                let key = kAXTrustedCheckOptionPrompt;
                let value = kCFBooleanTrue;
                let options = CFDictionaryCreate(
                    std::ptr::null(),
                    &key,
                    &value,
                    1,
                    &kCFTypeDictionaryKeyCallBacks,
                    &kCFTypeDictionaryValueCallBacks,
                );
                let trusted = if options.is_null() {
                    AXIsProcessTrusted()
                } else {
                    let result = AXIsProcessTrustedWithOptions(options);
                    CFRelease(options);
                    result
                };
                trusted != 0
            } else {
                // Prefer the basic trusted check — WithOptions(null) can disagree
                // on some OS versions and produced false "granted" badges.
                AXIsProcessTrusted() != 0
            }
        };

        return AccessibilityPermissionStatus {
            granted,
            executable_path,
            process_name,
        };
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Win32 / Linux desktop builds are not gated by a macOS-style Accessibility
        // toggle, but do not claim a TCC grant we cannot verify. UI labels this as
        // ready/not-required on those hosts via `requiredOnHost`.
        let _ = prompt;
        AccessibilityPermissionStatus {
            granted: true,
            executable_path,
            process_name,
        }
    }
}

#[tauri::command]
pub fn check_screen_permission() -> ScreenPermissionStatus {
    #[cfg(target_os = "macos")]
    {
        #[link(name = "CoreGraphics", kind = "framework")]
        extern "C" {
            fn CGPreflightScreenCaptureAccess() -> bool;
        }
        // Direct TCC preflight for THIS process — do not invent a grant.
        let granted = unsafe { CGPreflightScreenCaptureAccess() };
        return ScreenPermissionStatus { granted };
    }

    #[cfg(target_os = "windows")]
    {
        // Unpackaged Win32 apps have no CGPreflight equivalent. Return false so
        // the UI must confirm via the capture bridge before showing Granted.
        ScreenPermissionStatus { granted: false }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        ScreenPermissionStatus { granted: false }
    }
}
