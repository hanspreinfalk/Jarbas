mod clerk_billing;
mod composio;
mod data_reset;
mod llm_settings;
mod paths;
mod pi_agent;
mod pi_analysis;
mod pi_chat;
mod pii_redact;
mod privacy_settings;
mod screenpipe;

use serde::Serialize;
use serde_json::Value;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
    // Prefer project-root .env.local (Vite + Convex convention). Fallbacks for cwd variants.
    let _ = dotenvy::from_filename("../.env.local");
    let _ = dotenvy::from_filename(".env.local");
    let _ = dotenvy::dotenv();
}

/// Resolve Composio API key: process env → ~/.jarbas cache (from Convex) → .env.local.
pub(crate) fn composio_api_key() -> Result<String, String> {
    load_env();

    if let Ok(key) = std::env::var("COMPOSIO_API_KEY") {
        let trimmed = key.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }

    if let Ok(cached) = std::fs::read_to_string(paths::JarbasPaths::composio_api_key_file()) {
        let trimmed = cached.trim().to_string();
        if !trimmed.is_empty() {
            // Keep child processes (Ask MCP) able to expand ${COMPOSIO_API_KEY}.
            unsafe {
                std::env::set_var("COMPOSIO_API_KEY", &trimmed);
            }
            return Ok(trimmed);
        }
    }

    Err(
        "COMPOSIO_API_KEY is not available. Sign in so Jarbas can load it from Convex, or add it to .env.local for local dev."
            .into(),
    )
}

/// Persist a Composio API key synced from Convex for this device.
#[tauri::command]
fn set_composio_api_key(api_key: String) -> Result<bool, String> {
    let trimmed = api_key.trim().to_string();
    if trimmed.is_empty() {
        return Err("Composio API key is empty".into());
    }

    paths::JarbasPaths::ensure_directories()
        .map_err(|error| format!("Could not create Jarbas directories: {error}"))?;

    let path = paths::JarbasPaths::composio_api_key_file();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }
    std::fs::write(&path, format!("{trimmed}\n"))
        .map_err(|error| format!("Could not write {}: {error}", path.display()))?;

    unsafe {
        std::env::set_var("COMPOSIO_API_KEY", &trimmed);
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }

    Ok(true)
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

fn app_web_origin() -> String {
    if cfg!(dev) {
        "http://localhost:1420".to_string()
    } else {
        format!("http://localhost:{PACKAGED_AUTH_PORT}")
    }
}

/// Clerk Account Portal dead-ends (not the Frontend API host).
fn is_clerk_account_portal_dead_end(url: &tauri::Url) -> bool {
    let host = url.host_str().unwrap_or("");
    let is_portal = host.ends_with(".accounts.dev") && !host.contains("clerk.accounts.dev");
    if !is_portal {
        return false;
    }
    matches!(url.path(), "/" | "/default-redirect" | "")
}

fn create_main_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    let app_origin = app_web_origin();
    let bounce_origin = app_origin.clone();
    let app_handle = app.handle().clone();

    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(app_origin.parse()?))
        .title("Deployment Company of San Francisco")
        .inner_size(1180.0, 780.0)
        .on_navigation(move |nav_url| {
            if !is_clerk_account_portal_dead_end(&nav_url) {
                return true;
            }

            // OAuth sometimes finishes on Account Portal /default-redirect instead of
            // our /sso-callback. Bounce back into the app and keep Clerk query params
            // (__clerk_db_jwt, etc.) so the session can sync.
            let query = nav_url
                .query()
                .map(|q| format!("?{q}"))
                .unwrap_or_default();
            let path = if nav_url.query().is_some() {
                "/sso-callback"
            } else {
                "/"
            };
            let target = format!("{bounce_origin}{path}{query}");
            eprintln!("jarbas: bouncing Clerk Account Portal → {target}");

            let handle = app_handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(30));
                if let Some(win) = handle.get_webview_window("main") {
                    let js = format!(
                        "window.location.replace({})",
                        serde_json::to_string(&target).unwrap_or_else(|_| "\"/\"".into())
                    );
                    let _ = win.eval(&js);
                }
            });
            false
        })
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
            privacy_settings::open_privacy_settings,
            privacy_settings::check_accessibility_permission,
            privacy_settings::check_screen_permission,
            set_composio_api_key,
            list_composio_toolkits,
            clerk_billing::sync_org_seat_limit,
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
            pi_analysis::recover_finished_analysis,
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
            pii_redact::get_redaction_prefs,
            pii_redact::set_auto_redact_on_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
