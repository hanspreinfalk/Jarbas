mod composio;
mod data_reset;
mod llm_settings;
mod paths;
mod pi_agent;
mod pi_analysis;
mod pi_chat;
mod pii_redact;
mod screenpipe;

use serde::Serialize;
use serde_json::Value;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn open_privacy_settings(pane: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = match pane.as_str() {
            "screen-recording" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
            }
            "accessibility" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
            }
            _ => return Err(format!("Unknown privacy pane: {pane}")),
        };

        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = pane;
        Err("Privacy settings redirect is only available on macOS".into())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AccessibilityPermissionStatus {
    granted: bool,
    executable_path: Option<String>,
    process_name: Option<String>,
}

#[tauri::command]
fn check_accessibility_permission(prompt: Option<bool>) -> AccessibilityPermissionStatus {
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
                let with_options = AXIsProcessTrustedWithOptions(std::ptr::null());
                let basic = AXIsProcessTrusted();
                with_options != 0 || basic != 0
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
        let _ = prompt;
        AccessibilityPermissionStatus {
            granted: false,
            executable_path,
            process_name,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolkitListResponse {
    items: Value,
    next_cursor: Option<String>,
    total_pages: u64,
    current_page: u64,
    total_items: u64,
}

pub(crate) fn load_env() {
    let _ = dotenvy::dotenv();
    let _ = dotenvy::from_filename("../.env");
    let _ = dotenvy::from_filename(".env");
}

pub(crate) fn composio_api_key() -> Result<String, String> {
    load_env();
    std::env::var("COMPOSIO_API_KEY")
        .map_err(|_| "COMPOSIO_API_KEY is not set. Add it to .env in the project root.".into())
}

#[tauri::command]
async fn list_composio_toolkits(
    cursor: Option<String>,
    limit: Option<u32>,
    search: Option<String>,
) -> Result<ToolkitListResponse, String> {
    let api_key = composio_api_key()?;
    let page_size = limit.unwrap_or(24).clamp(1, 100);

    let client = reqwest::Client::new();
    let mut request = client
        .get("https://backend.composio.dev/api/v3/toolkits")
        .header("x-api-key", api_key)
        .query(&[
            ("limit", page_size.to_string()),
            ("sort_by", "usage".to_string()),
        ]);

    if let Some(cursor) = cursor.filter(|value| !value.is_empty()) {
        request = request.query(&[("cursor", cursor)]);
    }

    if let Some(search) = search.filter(|value| !value.trim().is_empty()) {
        request = request.query(&[("search", search.trim())]);
    }

    let response = request.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;

    if !status.is_success() {
        return Err(format!("Composio API error ({status}): {body}"));
    }

    let payload: Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;

    Ok(ToolkitListResponse {
        items: payload
            .get("items")
            .cloned()
            .unwrap_or_else(|| Value::Array(vec![])),
        next_cursor: payload
            .get("next_cursor")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        total_pages: payload
            .get("total_pages")
            .and_then(|value| value.as_u64())
            .unwrap_or(1),
        current_page: payload
            .get("current_page")
            .and_then(|value| value.as_u64())
            .unwrap_or(1),
        total_items: payload
            .get("total_items")
            .and_then(|value| value.as_u64())
            .unwrap_or(0),
    })
}

/// Packaged builds serve the UI over http://localhost so Clerk accepts
/// redirect_url (tauri:// is rejected with invalid_url_scheme).
const PACKAGED_AUTH_PORT: u16 = 1421;

fn create_main_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let url = if cfg!(dev) {
        // Matches tauri.conf.json build.devUrl / Vite.
        "http://localhost:1420".parse()?
    } else {
        format!("http://localhost:{PACKAGED_AUTH_PORT}").parse()?
    };

    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("Deployment Company of San Francisco")
        .inner_size(1180.0, 780.0)
        .build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_env();

    #[cfg(dev)]
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(not(dev))]
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_localhost::Builder::new(PACKAGED_AUTH_PORT).build());

    builder
        .manage(pi_agent::PiAgentState::default())
        .manage(pi_chat::AskChatState::default())
        .manage(pi_analysis::AnalysisState::default())
        .setup(|app| {
            // Never return Err from setup on macOS: Tauri panics inside
            // tao's did_finish_launching (extern "C"), which becomes
            // panic_cannot_unwind → SIGABRT. Capture init failure instead.
            if let Err(error) = create_main_window(app) {
                eprintln!("main window create failed: {error}");
            }
            if let Err(error) = screenpipe::init_host(app) {
                eprintln!("capture host init failed: {error}");
            }
            pi_agent::spawn_ensure_installed(app.handle().clone(), false);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            open_privacy_settings,
            check_accessibility_permission,
            list_composio_toolkits,
            composio::list_composio_connected_accounts,
            composio::create_composio_connect_link,
            composio::delete_composio_connected_account,
            pi_agent::get_pi_agent_status,
            pi_agent::ensure_pi_agent_installed,
            llm_settings::get_llm_settings,
            llm_settings::set_llm_api_key,
            llm_settings::clear_llm_api_key,
            llm_settings::set_llm_model,
            pi_chat::ask_send_prompt,
            pi_chat::ask_abort,
            pi_chat::ask_new_session,
            pi_analysis::list_analysis_items,
            pi_analysis::delete_analysis_item,
            pi_analysis::update_analysis_item,
            pi_analysis::get_analysis_status,
            pi_analysis::start_analysis,
            pi_analysis::abort_analysis,
            screenpipe::screenpipe_default_paths,
            screenpipe::screenpipe_permissions,
            screenpipe::screenpipe_start,
            screenpipe::screenpipe_stop,
            screenpipe::screenpipe_status,
            screenpipe::screenpipe_snapshot,
            screenpipe::screenpipe_reveal,
            screenpipe::screenpipe_dispose,
            screenpipe::screenpipe_events,
            screenpipe::screenpipe_identify,
            screenpipe::capture_last_session,
            screenpipe::capture_storage_stats,
            data_reset::reset_jarbas_data,
            pii_redact::redact_jarbas_capture,
            pii_redact::get_last_redaction,
            pii_redact::get_redaction_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
