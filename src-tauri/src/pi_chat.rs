use crate::llm_settings;
use crate::paths::JarbasPaths;
use crate::pi_agent;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const EVENT_NAME: &str = "ask-event";

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AskEvent {
    AgentStart,
    AgentSettled,
    #[serde(rename_all = "camelCase")]
    TextDelta { delta: String },
    #[serde(rename_all = "camelCase")]
    ThinkingDelta { delta: String },
    #[serde(rename_all = "camelCase")]
    ToolStart {
        tool_call_id: String,
        tool_name: String,
        label: String,
        args: Value,
    },
    #[serde(rename_all = "camelCase")]
    ToolUpdate {
        tool_call_id: String,
        tool_name: String,
        label: String,
        partial_result: String,
    },
    #[serde(rename_all = "camelCase")]
    ToolEnd {
        tool_call_id: String,
        tool_name: String,
        label: String,
        is_error: bool,
        result: String,
    },
    #[serde(rename_all = "camelCase")]
    Error { message: String },
}

struct PendingResponse {
    tx: Sender<Result<Value, String>>,
}

struct PiProcess {
    child: Child,
    stdin: ChildStdin,
    provider: String,
    model: String,
    composio_user_id: Option<String>,
}

pub struct AskChatState {
    process: Mutex<Option<PiProcess>>,
    pending: Mutex<HashMap<String, PendingResponse>>,
    next_id: AtomicU64,
    /// Signed-in Composio user id for the next / current Pi process.
    composio_user_id: Mutex<Option<String>>,
}

impl Default for AskChatState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
            pending: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            composio_user_id: Mutex::new(None),
        }
    }
}

fn tool_label(name: &str) -> String {
    let base = name.split("__").last().unwrap_or(name);
    let lower = base.to_ascii_lowercase();
    match lower.as_str() {
        "bash" | "shell" | "run_terminal_cmd" => "bash".into(),
        "read" | "read_file" => "read".into(),
        "write" | "write_file" => "write".into(),
        "edit" | "apply_patch" => "edit".into(),
        "grep" | "rg" | "search" => "search".into(),
        "find" | "glob" => "find".into(),
        "ls" => "ls".into(),
        other if other.contains("composio") && other.contains("search") => {
            "Composio search".into()
        }
        other if other.contains("composio") && other.contains("multi") => {
            "Composio execute".into()
        }
        other if other.contains("composio") => "Composio".into(),
        other => other.replace('-', " ").replace('_', " "),
    }
}

fn extract_text_result(value: &Value) -> String {
    if let Some(content) = value.get("content").and_then(|v| v.as_array()) {
        let parts: Vec<String> = content
            .iter()
            .filter_map(|block| {
                if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                    block
                        .get("text")
                        .and_then(|t| t.as_str())
                        .map(str::to_string)
                } else {
                    None
                }
            })
            .collect();
        if !parts.is_empty() {
            return parts.join("");
        }
    }
    value
        .as_str()
        .map(str::to_string)
        .unwrap_or_else(|| value.to_string())
}

fn emit_ask(app: &AppHandle, event: AskEvent) {
    let _ = app.emit(EVENT_NAME, &event);
}

fn handle_stdout_line(app: &AppHandle, state: &AskChatState, line: &str) {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return;
    };
    let Some(event_type) = value.get("type").and_then(|v| v.as_str()) else {
        return;
    };

    if event_type == "response" {
        if let Some(id) = value.get("id").and_then(|v| v.as_str()) {
            let mut pending = state.pending.lock().unwrap_or_else(|p| p.into_inner());
            if let Some(waiter) = pending.remove(id) {
                let success = value
                    .get("success")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                if success {
                    let _ = waiter.tx.send(Ok(value));
                } else {
                    let message = value
                        .get("error")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Pi command failed")
                        .to_string();
                    let _ = waiter.tx.send(Err(message));
                }
            }
        }
        return;
    }

    match event_type {
        "agent_start" => emit_ask(app, AskEvent::AgentStart),
        "agent_settled" => emit_ask(app, AskEvent::AgentSettled),
        "message_update" => {
            let Some(delta) = value.get("assistantMessageEvent") else {
                return;
            };
            let Some(delta_type) = delta.get("type").and_then(|v| v.as_str()) else {
                return;
            };
            match delta_type {
                "text_delta" => {
                    if let Some(text) = delta.get("delta").and_then(|v| v.as_str()) {
                        if !text.is_empty() {
                            emit_ask(app, AskEvent::TextDelta { delta: text.into() });
                        }
                    }
                }
                "thinking_delta" => {
                    if let Some(text) = delta.get("delta").and_then(|v| v.as_str()) {
                        if !text.is_empty() {
                            emit_ask(
                                app,
                                AskEvent::ThinkingDelta {
                                    delta: text.into(),
                                },
                            );
                        }
                    }
                }
                "error" => {
                    let message = delta
                        .get("error")
                        .or_else(|| delta.get("reason"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("Assistant error")
                        .to_string();
                    emit_ask(app, AskEvent::Error { message });
                }
                _ => {}
            }
        }
        "tool_execution_start" => {
            let tool_name = value
                .get("toolName")
                .and_then(|v| v.as_str())
                .unwrap_or("tool")
                .to_string();
            let tool_call_id = value
                .get("toolCallId")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let args = value.get("args").cloned().unwrap_or(Value::Null);
            emit_ask(
                app,
                AskEvent::ToolStart {
                    label: tool_label(&tool_name),
                    tool_call_id,
                    tool_name,
                    args,
                },
            );
        }
        "tool_execution_update" => {
            let tool_name = value
                .get("toolName")
                .and_then(|v| v.as_str())
                .unwrap_or("tool")
                .to_string();
            let tool_call_id = value
                .get("toolCallId")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let partial = value
                .get("partialResult")
                .map(extract_text_result)
                .unwrap_or_default();
            emit_ask(
                app,
                AskEvent::ToolUpdate {
                    label: tool_label(&tool_name),
                    tool_call_id,
                    tool_name,
                    partial_result: partial,
                },
            );
        }
        "tool_execution_end" => {
            let tool_name = value
                .get("toolName")
                .and_then(|v| v.as_str())
                .unwrap_or("tool")
                .to_string();
            let tool_call_id = value
                .get("toolCallId")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let is_error = value
                .get("isError")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let result = value
                .get("result")
                .map(extract_text_result)
                .unwrap_or_default();
            emit_ask(
                app,
                AskEvent::ToolEnd {
                    label: tool_label(&tool_name),
                    tool_call_id,
                    tool_name,
                    is_error,
                    result,
                },
            );
        }
        _ => {}
    }
}

fn stop_process(state: &AskChatState) {
    let mut guard = state.process.lock().unwrap_or_else(|p| p.into_inner());
    if let Some(mut proc) = guard.take() {
        let _ = writeln!(proc.stdin, "{}", json!({"type":"abort"}));
        let _ = proc.stdin.flush();
        let _ = proc.child.kill();
        let _ = proc.child.wait();
    }
    state
        .pending
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clear();
}

fn start_process(app: &AppHandle, state: &AskChatState) -> Result<(), String> {
    let (provider, model, env_keys) = llm_settings::load_runtime_llm()?;
    let node = pi_agent::find_node(app).ok_or_else(|| {
        "Bundled Node runtime is missing. Run npm run fetch-node, then rebuild.".to_string()
    })?;
    if !pi_agent::is_installed() {
        return Err("Assistant is still setting up. Wait a moment, then try again.".into());
    }
    JarbasPaths::ensure_directories()?;

    let home = JarbasPaths::home();

    let composio_user_id = state
        .composio_user_id
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();

    // Attach Composio Tool Router MCP for this user before spawning Pi.
    match crate::composio::configure_composio_mcp_for_user(composio_user_id.as_deref()) {
        Ok(Some(session_id)) => {
            eprintln!("[ask] composio tool router session {session_id}");
        }
        Ok(None) => {
            eprintln!("[ask] composio MCP not attached (missing user id or API key)");
        }
        Err(error) => {
            eprintln!("[ask] composio MCP setup failed: {error}");
            // Still start Ask for local questions; skill will explain app tools unavailable.
            let _ = crate::composio::configure_composio_mcp_for_user(None);
        }
    }

    let node_bin = node.parent().map(|path| path.to_path_buf()).unwrap_or_default();
    // Prefer app-owned ~/.jarbas/bin (kept for diagnostics; apps use Tool Router MCP).
    let path = crate::paths::child_path_env(&[JarbasPaths::bin_dir(), node_bin]);

    let mut command = Command::new(&node);
    command
        .arg(JarbasPaths::pi_cli())
        .arg("--mode")
        .arg("rpc")
        .arg("--no-session")
        .arg("--provider")
        .arg(provider.as_str())
        .arg("--model")
        .arg(&model)
        .current_dir(&home)
        .env("PI_CODING_AGENT", "true")
        .env("PI_CODING_AGENT_DIR", JarbasPaths::pi_config())
        .env("PATH", &path)
        .env("HOME", &home)
        .env("USERPROFILE", &home)
        .env("COMPOSIO_CACHE_DIR", JarbasPaths::composio_home())
        .env("COMPOSIO_INSTALL_DIR", JarbasPaths::composio_cli_dir())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    for (key, value) in env_keys {
        command.env(key, value);
    }

    crate::load_env();
    if let Ok(api_key) = std::env::var("COMPOSIO_API_KEY") {
        if !api_key.trim().is_empty() {
            command.env("COMPOSIO_API_KEY", api_key);
        }
    }
    if let Some(user_id) = composio_user_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        command.env("COMPOSIO_TEST_USER_ID", user_id);
        command.env("COMPOSIO_USER_ID", user_id);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start assistant: {error}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Assistant stdin unavailable.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Assistant stdout unavailable.".to_string())?;

    // Drain stderr so the process cannot block; keep console quiet for
    // routine npm/install noise.
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let lower = trimmed.to_ascii_lowercase();
                let noisy = lower.contains("both google_api_key and gemini_api_key")
                    || lower.contains("found 0 vulnerabilities")
                    || lower.contains("added ")
                    || lower.contains("npm warn")
                    || lower.starts_with("npm ");
                if !noisy {
                    eprintln!("[pi] {trimmed}");
                }
            }
        });
    }

    {
        let mut guard = state.process.lock().unwrap_or_else(|p| p.into_inner());
        *guard = Some(PiProcess {
            child,
            stdin,
            provider: provider.as_str().into(),
            model: model.clone(),
            composio_user_id,
        });
    }

    let app_reader = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut buffer = String::new();
        for byte in reader.bytes() {
            let Ok(byte) = byte else { break };
            if byte == b'\n' {
                if buffer.ends_with('\r') {
                    buffer.pop();
                }
                if !buffer.is_empty() {
                    let ask_state = app_reader.state::<AskChatState>();
                    handle_stdout_line(&app_reader, &ask_state, &buffer);
                }
                buffer.clear();
            } else {
                buffer.push(byte as char);
            }
        }
        if !buffer.is_empty() {
            if buffer.ends_with('\r') {
                buffer.pop();
            }
            let ask_state = app_reader.state::<AskChatState>();
            handle_stdout_line(&app_reader, &ask_state, &buffer);
        }
        emit_ask(
            &app_reader,
            AskEvent::Error {
                message: "Assistant process stopped.".into(),
            },
        );
        let ask_state = app_reader.state::<AskChatState>();
        let mut guard = ask_state.process.lock().unwrap_or_else(|p| p.into_inner());
        *guard = None;
    });

    let _ = send_command(
        state,
        json!({
            "type": "set_model",
            "provider": provider.as_str(),
            "modelId": model,
        }),
        Duration::from_secs(20),
    );

    Ok(())
}

fn ensure_process(app: &AppHandle, state: &AskChatState) -> Result<(), String> {
    let (provider, model, _) = llm_settings::load_runtime_llm()?;
    let desired_composio_user = state
        .composio_user_id
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let needs_restart = {
        let guard = state.process.lock().unwrap_or_else(|p| p.into_inner());
        match guard.as_ref() {
            None => true,
            Some(proc) => {
                proc.provider != provider.as_str()
                    || proc.model != model
                    || proc.composio_user_id != desired_composio_user
            }
        }
    };
    if needs_restart {
        stop_process(state);
        start_process(app, state)?;
    } else if let Err(error) = send_command(
        state,
        json!({
            "type": "set_model",
            "provider": provider.as_str(),
            "modelId": model,
        }),
        Duration::from_secs(10),
    ) {
        // Process may be half-dead; restart once.
        eprintln!("[ask] set_model failed, restarting: {error}");
        stop_process(state);
        start_process(app, state)?;
    }
    Ok(())
}

fn send_command(
    state: &AskChatState,
    mut command: Value,
    timeout: Duration,
) -> Result<Value, String> {
    let id = state.next_id.fetch_add(1, Ordering::Relaxed).to_string();
    command
        .as_object_mut()
        .ok_or_else(|| "Invalid command".to_string())?
        .insert("id".into(), Value::String(id.clone()));

    let (tx, rx): (
        Sender<Result<Value, String>>,
        Receiver<Result<Value, String>>,
    ) = mpsc::channel();
    {
        let mut pending = state.pending.lock().unwrap_or_else(|p| p.into_inner());
        pending.insert(id.clone(), PendingResponse { tx });
    }

    {
        let mut guard = state.process.lock().unwrap_or_else(|p| p.into_inner());
        let proc = guard
            .as_mut()
            .ok_or_else(|| "Assistant is not running.".to_string())?;
        let line = serde_json::to_string(&command)
            .map_err(|error| format!("Could not encode command: {error}"))?;
        writeln!(proc.stdin, "{line}")
            .map_err(|error| format!("Could not write to assistant: {error}"))?;
        proc.stdin
            .flush()
            .map_err(|error| format!("Could not flush assistant stdin: {error}"))?;
    }

    match rx.recv_timeout(timeout) {
        Ok(result) => result,
        Err(_) => {
            state
                .pending
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .remove(&id);
            Err("Assistant timed out.".into())
        }
    }
}

#[tauri::command]
pub fn ask_send_prompt(
    app: AppHandle,
    message: String,
    time_zone: Option<String>,
    local_time: Option<String>,
    composio_user_id: Option<String>,
) -> Result<(), String> {
    let trimmed = message.trim().to_string();
    if trimmed.is_empty() {
        return Err("Message is empty.".into());
    }

    let state = app.state::<AskChatState>();
    {
        let mut guard = state
            .composio_user_id
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        *guard = composio_user_id
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
    }

    let prompt = match (
        time_zone
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
        local_time
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    ) {
        (Some(tz), Some(local)) => format!(
            "[Context: User timezone is {tz}. Current local time is {local}. Convert every date/time you show into this local timezone. Never show raw UTC ISO-8601. Audio: Jarbas does not have access to audio yet; do not say \"no captured audio\" - say we do not have access to audio yet and suggest connecting Granola or similar for transcripts. Never mention Screenpipe or other capture vendor/SDK names to the user. External apps: use Composio Tool Router MCP tools from the composio skill. Never bash the composio CLI.]\n\n{trimmed}"
        ),
        (Some(tz), None) => format!(
            "[Context: User timezone is {tz}. Convert every date/time you show into this local timezone. Never show raw UTC ISO-8601. Audio: Jarbas does not have access to audio yet; do not say \"no captured audio\" - say we do not have access to audio yet and suggest connecting Granola or similar for transcripts. Never mention Screenpipe or other capture vendor/SDK names to the user. External apps: use Composio Tool Router MCP tools from the composio skill. Never bash the composio CLI.]\n\n{trimmed}"
        ),
        _ => trimmed,
    };

    ensure_process(&app, &state)?;
    send_command(
        &state,
        json!({
            "type": "prompt",
            "message": prompt,
        }),
        Duration::from_secs(30),
    )?;
    Ok(())
}

#[tauri::command]
pub fn ask_abort(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AskChatState>();
    let running = state
        .process
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .is_some();
    if !running {
        return Ok(());
    }
    let _ = send_command(&state, json!({ "type": "abort" }), Duration::from_secs(5));
    Ok(())
}

#[tauri::command]
pub fn ask_new_session(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AskChatState>();
    let running = state
        .process
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .is_some();
    if !running {
        return Ok(());
    }
    send_command(
        &state,
        json!({ "type": "new_session" }),
        Duration::from_secs(10),
    )?;
    Ok(())
}
