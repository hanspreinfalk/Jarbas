use crate::llm_settings;
use crate::paths::JarbasPaths;
use crate::pi_agent;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

const EVENT_NAME: &str = "analysis-event";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AnalysisKind {
    Learnings,
    Opportunities,
    Reports,
}

impl AnalysisKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Learnings => "learnings",
            Self::Opportunities => "opportunities",
            Self::Reports => "reports",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "learnings" => Some(Self::Learnings),
            "opportunities" => Some(Self::Opportunities),
            "reports" => Some(Self::Reports),
            _ => None,
        }
    }

    pub fn dir(self) -> PathBuf {
        match self {
            Self::Learnings => JarbasPaths::learnings_dir(),
            Self::Opportunities => JarbasPaths::opportunities_dir(),
            Self::Reports => JarbasPaths::reports_dir(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AnalysisEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        job_id: String,
        kind: AnalysisKind,
    },
    #[serde(rename_all = "camelCase")]
    Status {
        job_id: String,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    TextDelta {
        job_id: String,
        delta: String,
    },
    #[serde(rename_all = "camelCase")]
    ThinkingDelta {
        job_id: String,
        delta: String,
    },
    #[serde(rename_all = "camelCase")]
    ToolStart {
        job_id: String,
        tool_call_id: String,
        tool_name: String,
        label: String,
        args: Value,
    },
    #[serde(rename_all = "camelCase")]
    ToolEnd {
        job_id: String,
        tool_call_id: String,
        tool_name: String,
        label: String,
        is_error: bool,
        result: String,
    },
    #[serde(rename_all = "camelCase")]
    Completed {
        job_id: String,
        kind: AnalysisKind,
        ids: Vec<String>,
    },
    #[serde(rename_all = "camelCase")]
    Cancelled {
        job_id: String,
    },
    #[serde(rename_all = "camelCase")]
    Error {
        job_id: Option<String>,
        message: String,
    },
}

struct PendingResponse {
    tx: Sender<Result<Value, String>>,
}

struct PiProcess {
    child: Child,
    stdin: ChildStdin,
}

#[derive(Debug, Clone)]
struct TranscriptTool {
    id: String,
    name: String,
    label: String,
    args: Value,
    status: String,
    result: String,
}

struct ActiveJob {
    id: String,
    kind: AnalysisKind,
    start_date: String,
    end_date: String,
    provider: String,
    model: String,
    accumulated: String,
    thinking: String,
    tools: Vec<TranscriptTool>,
    started_at_ms: u128,
    settled: bool,
}

pub struct AnalysisState {
    process: Mutex<Option<PiProcess>>,
    pending: Mutex<HashMap<String, PendingResponse>>,
    next_id: AtomicU64,
    job: Mutex<Option<ActiveJob>>,
}

impl Default for AnalysisState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
            pending: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            job: Mutex::new(None),
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

fn emit(app: &AppHandle, event: AnalysisEvent) {
    let _ = app.emit(EVENT_NAME, &event);
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn slugify(raw: &str) -> String {
    let mut out = String::new();
    for ch in raw.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if matches!(ch, '-' | '_' | ' ') && !out.ends_with('-') {
            out.push('-');
        }
    }
    out.trim_matches('-').chars().take(48).collect()
}

fn extract_json_value(text: &str) -> Option<Value> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        return Some(value);
    }
    if let Some(start) = trimmed.find("```") {
        let after_fence = &trimmed[start + 3..];
        let body = after_fence
            .strip_prefix("json")
            .or_else(|| after_fence.strip_prefix("JSON"))
            .unwrap_or(after_fence);
        let body = body.trim_start_matches('\n');
        if let Some(end) = body.find("```") {
            let block = body[..end].trim();
            if let Ok(value) = serde_json::from_str::<Value>(block) {
                return Some(value);
            }
        }
    }
    // Last resort: first { or [ to matching end.
    let bytes = trimmed.as_bytes();
    let start = bytes.iter().position(|b| *b == b'{' || *b == b'[')?;
    let open = bytes[start];
    let close = if open == b'{' { b'}' } else { b']' };
    let mut depth = 0i32;
    let mut in_string = false;
    let mut escape = false;
    for (idx, byte) in bytes.iter().enumerate().skip(start) {
        let ch = *byte;
        if in_string {
            if escape {
                escape = false;
            } else if ch == b'\\' {
                escape = true;
            } else if ch == b'"' {
                in_string = false;
            }
            continue;
        }
        match ch {
            b'"' => in_string = true,
            b if b == open => depth += 1,
            b if b == close => {
                depth -= 1;
                if depth == 0 {
                    let slice = &trimmed[start..=idx];
                    if let Ok(value) = serde_json::from_str::<Value>(slice) {
                        return Some(value);
                    }
                    break;
                }
            }
            _ => {}
        }
    }
    None
}

fn read_job_file(job_id: &str) -> Option<Value> {
    let path = JarbasPaths::analysis_job_file(job_id);
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn ensure_string_id(item: &mut Value, fallback: &str) -> String {
    let id = item
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| fallback.to_string());
    if let Some(obj) = item.as_object_mut() {
        obj.insert("id".into(), Value::String(id.clone()));
    }
    id
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

fn build_analysis_blob(job: &ActiveJob) -> Value {
    let tools: Vec<Value> = job
        .tools
        .iter()
        .map(|tool| {
            json!({
                "id": tool.id,
                "name": tool.name,
                "label": tool.label,
                "args": tool.args,
                "status": tool.status,
                "result": tool.result,
            })
        })
        .collect();
    json!({
        "jobId": job.id,
        "kind": job.kind.as_str(),
        "startDate": job.start_date,
        "endDate": job.end_date,
        "provider": job.provider,
        "model": job.model,
        "content": job.accumulated,
        "thinking": job.thinking,
        "tools": tools,
        "startedAt": job.started_at_ms,
        "finishedAt": now_millis(),
    })
}

fn save_analysis_run(job: &ActiveJob, analysis: &Value) -> Result<(), String> {
    let dir = JarbasPaths::analysis_runs_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let path = dir.join(format!("{}.json", job.id));
    let body = serde_json::to_string_pretty(analysis)
        .map_err(|e| format!("Could not encode analysis run: {e}"))?;
    fs::write(&path, body + "\n").map_err(|e| format!("Could not write {}: {e}", path.display()))?;
    Ok(())
}

fn attach_meta(obj: &mut serde_json::Map<String, Value>, job: &ActiveJob, created_at: &str, analysis: &Value) {
    obj.entry("createdAt")
        .or_insert_with(|| Value::String(created_at.to_string()));
    obj.insert("startDate".into(), Value::String(job.start_date.clone()));
    obj.insert("endDate".into(), Value::String(job.end_date.clone()));
    obj.insert("provider".into(), Value::String(job.provider.clone()));
    obj.insert("model".into(), Value::String(job.model.clone()));
    obj.insert("jobId".into(), Value::String(job.id.clone()));
    obj.insert("analysis".into(), analysis.clone());
}

fn write_item_file(kind: AnalysisKind, item: &Value) -> Result<String, String> {
    let id = item
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing id".to_string())?;
    let dir = kind.dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let path = dir.join(format!("{id}.json"));
    let body = serde_json::to_string_pretty(item)
        .map_err(|e| format!("Could not encode item: {e}"))?;
    fs::write(&path, body + "\n").map_err(|e| format!("Could not write {}: {e}", path.display()))?;
    Ok(id.to_string())
}

fn persist_payload(
    job: &ActiveJob,
    payload: Value,
) -> Result<Vec<String>, String> {
    let created_at = chrono_like_local();
    let analysis = build_analysis_blob(job);
    let _ = save_analysis_run(job, &analysis);

    match job.kind {
        AnalysisKind::Reports => {
            let mut report = if let Some(inner) = payload.get("report").cloned() {
                inner
            } else if payload.get("title").is_some() {
                payload
            } else {
                return Err("Report JSON missing title / report object.".into());
            };
            let fallback = format!("report-{}-{}", job.start_date, now_millis());
            let _id = ensure_string_id(&mut report, &fallback);
            if let Some(obj) = report.as_object_mut() {
                attach_meta(obj, job, &created_at, &analysis);
                if obj.get("period").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
                    obj.insert(
                        "period".into(),
                        Value::String(format_period(&job.start_date, &job.end_date)),
                    );
                }
                if obj
                    .get("generatedAt")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .is_empty()
                {
                    obj.insert("generatedAt".into(), Value::String(created_at));
                }
            }
            Ok(vec![write_item_file(job.kind, &report)?])
        }
        AnalysisKind::Learnings | AnalysisKind::Opportunities => {
            let items = if let Some(arr) = payload.get("items").and_then(|v| v.as_array()) {
                arr.clone()
            } else if payload.is_array() {
                payload.as_array().cloned().unwrap_or_default()
            } else {
                return Err(format!(
                    "Expected an items array for {}.",
                    job.kind.as_str()
                ));
            };
            if items.is_empty() {
                return Err(format!(
                    "No {} found for this timeframe. Capture more activity, then retry.",
                    job.kind.as_str()
                ));
            }
            let mut ids = Vec::new();
            for (index, raw) in items.into_iter().enumerate() {
                let mut item = raw;
                let title = item
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("item");
                let fallback = format!(
                    "{}-{}-{}-{}",
                    job.kind.as_str().trim_end_matches('s'),
                    slugify(title),
                    job.start_date.replace('-', ""),
                    index + 1
                );
                let id = ensure_string_id(&mut item, &fallback);
                if let Some(obj) = item.as_object_mut() {
                    attach_meta(obj, job, &created_at, &analysis);
                }
                ids.push(write_item_file(job.kind, &item)?);
                let _ = id;
            }
            Ok(ids)
        }
    }
}

fn format_period(start: &str, end: &str) -> String {
    if start == end {
        start.to_string()
    } else {
        format!("{start} → {end}")
    }
}

fn chrono_like_local() -> String {
    // Prefer a friendly local stamp when the Unix `date` helper exists.
    #[cfg(unix)]
    {
        let output = Command::new("date")
            .arg("+%b %-d, %Y · %-I:%M %p")
            .output()
            .ok()
            .and_then(|out| String::from_utf8(out.stdout).ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        if let Some(stamp) = output {
            return stamp;
        }
    }
    // Portable fallback (ISO-ish UTC millis).
    format!("{}", now_millis())
}

fn finish_job(app: &AppHandle, state: &AnalysisState) {
    let job = {
        let mut guard = state.job.lock().unwrap_or_else(|p| p.into_inner());
        match guard.as_mut() {
            Some(job) if !job.settled => {
                job.settled = true;
                Some(ActiveJob {
                    id: job.id.clone(),
                    kind: job.kind,
                    start_date: job.start_date.clone(),
                    end_date: job.end_date.clone(),
                    provider: job.provider.clone(),
                    model: job.model.clone(),
                    accumulated: job.accumulated.clone(),
                    thinking: job.thinking.clone(),
                    tools: job.tools.clone(),
                    started_at_ms: job.started_at_ms,
                    settled: true,
                })
            }
            _ => None,
        }
    };
    let Some(job) = job else { return };

    emit(
        app,
        AnalysisEvent::Status {
            job_id: job.id.clone(),
            message: "Saving results…".into(),
        },
    );

    let payload = read_job_file(&job.id)
        .or_else(|| extract_json_value(&job.accumulated));

    let result = match payload {
        Some(value) => persist_payload(&job, value),
        None => Err(
            "Analysis finished but no JSON was produced. Try again with a longer timeframe or another model."
                .into(),
        ),
    };

    let _ = fs::remove_file(JarbasPaths::analysis_job_file(&job.id));
    stop_process(state);
    {
        let mut guard = state.job.lock().unwrap_or_else(|p| p.into_inner());
        *guard = None;
    }

    match result {
        Ok(ids) => emit(
            app,
            AnalysisEvent::Completed {
                job_id: job.id,
                kind: job.kind,
                ids,
            },
        ),
        Err(message) => emit(
            app,
            AnalysisEvent::Error {
                job_id: Some(job.id),
                message,
            },
        ),
    }
}

fn handle_stdout_line(app: &AppHandle, state: &AnalysisState, line: &str) {
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

    let job_id = state
        .job
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .as_ref()
        .map(|job| job.id.clone());

    match event_type {
        "agent_start" => {
            if let Some(job_id) = job_id {
                emit(
                    app,
                    AnalysisEvent::Status {
                        job_id,
                        message: "Analyzing captured activity…".into(),
                    },
                );
            }
        }
        "agent_settled" => finish_job(app, state),
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
                        if text.is_empty() {
                            return;
                        }
                        if let Some(job) = state
                            .job
                            .lock()
                            .unwrap_or_else(|p| p.into_inner())
                            .as_mut()
                        {
                            job.accumulated.push_str(text);
                            emit(
                                app,
                                AnalysisEvent::TextDelta {
                                    job_id: job.id.clone(),
                                    delta: text.into(),
                                },
                            );
                        }
                    }
                }
                "thinking_delta" => {
                    if let Some(text) = delta.get("delta").and_then(|v| v.as_str()) {
                        if text.is_empty() {
                            return;
                        }
                        if let Some(job) = state
                            .job
                            .lock()
                            .unwrap_or_else(|p| p.into_inner())
                            .as_mut()
                        {
                            job.thinking.push_str(text);
                            emit(
                                app,
                                AnalysisEvent::ThinkingDelta {
                                    job_id: job.id.clone(),
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
                    emit(
                        app,
                        AnalysisEvent::Error {
                            job_id,
                            message,
                        },
                    );
                    stop_process(state);
                    let mut guard = state.job.lock().unwrap_or_else(|p| p.into_inner());
                    *guard = None;
                }
                _ => {}
            }
        }
        "tool_execution_start" => {
            let Some(job_id) = job_id else { return };
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
            let label = tool_label(&tool_name);
            if let Some(job) = state
                .job
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .as_mut()
            {
                job.tools.push(TranscriptTool {
                    id: tool_call_id.clone(),
                    name: tool_name.clone(),
                    label: label.clone(),
                    args: args.clone(),
                    status: "running".into(),
                    result: String::new(),
                });
            }
            emit(
                app,
                AnalysisEvent::ToolStart {
                    job_id: job_id.clone(),
                    tool_call_id,
                    label: label.clone(),
                    tool_name,
                    args,
                },
            );
        }
        "tool_execution_end" => {
            let Some(job_id) = job_id else { return };
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
            let label = tool_label(&tool_name);
            if let Some(job) = state
                .job
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .as_mut()
            {
                if let Some(tool) = job.tools.iter_mut().rev().find(|t| t.id == tool_call_id) {
                    tool.status = if is_error { "error" } else { "done" }.into();
                    tool.result = result.clone();
                }
            }
            emit(
                app,
                AnalysisEvent::ToolEnd {
                    job_id,
                    tool_call_id,
                    label,
                    tool_name,
                    is_error,
                    result,
                },
            );
        }
        _ => {}
    }
}

fn stop_process(state: &AnalysisState) {
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

fn start_process(
    app: &AppHandle,
    state: &AnalysisState,
    provider: &str,
    model: &str,
    env_keys: &std::collections::BTreeMap<String, String>,
    composio_user_id: Option<&str>,
) -> Result<(), String> {
    let node = pi_agent::find_node(app).ok_or_else(|| {
        "Bundled Node runtime is missing. Run npm run fetch-node, then rebuild.".to_string()
    })?;
    if !pi_agent::is_installed() {
        return Err("Assistant is still setting up. Wait a moment, then try again.".into());
    }
    JarbasPaths::ensure_directories()?;

    let home = JarbasPaths::home();

    let composio_user = composio_user_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    // Attach Composio Tool Router MCP so analysis can read connected apps.
    match crate::composio::configure_composio_mcp_for_user(composio_user.as_deref()) {
        Ok(Some(session_id)) => {
            eprintln!("[analysis] composio tool router session {session_id}");
        }
        Ok(None) => {
            eprintln!("[analysis] composio MCP not attached (missing user id or API key)");
        }
        Err(error) => {
            eprintln!("[analysis] composio MCP setup failed: {error}");
            // Continue with local capture only.
        }
    }

    let node_bin = node.parent().map(|path| path.to_path_buf()).unwrap_or_default();
    let path = crate::paths::child_path_env(&[JarbasPaths::bin_dir(), node_bin]);

    let mut command = Command::new(&node);
    command
        .arg(JarbasPaths::pi_cli())
        .arg("--mode")
        .arg("rpc")
        .arg("--no-session")
        .arg("--provider")
        .arg(provider)
        .arg("--model")
        .arg(model)
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
    if let Some(user_id) = composio_user.as_deref() {
        command.env("COMPOSIO_TEST_USER_ID", user_id);
        command.env("COMPOSIO_USER_ID", user_id);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start analysis agent: {error}"))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Analysis agent stdin unavailable.".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Analysis agent stdout unavailable.".to_string())?;

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
                    eprintln!("[analysis-pi] {trimmed}");
                }
            }
        });
    }

    {
        let mut guard = state.process.lock().unwrap_or_else(|p| p.into_inner());
        *guard = Some(PiProcess { child, stdin });
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
                    let analysis_state = app_reader.state::<AnalysisState>();
                    handle_stdout_line(&app_reader, &analysis_state, &buffer);
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
            let analysis_state = app_reader.state::<AnalysisState>();
            handle_stdout_line(&app_reader, &analysis_state, &buffer);
        }
        // Process died before settle — fail open job if still active.
        let analysis_state = app_reader.state::<AnalysisState>();
        let unfinished = {
            let guard = analysis_state.job.lock().unwrap_or_else(|p| p.into_inner());
            guard
                .as_ref()
                .filter(|job| !job.settled)
                .map(|job| job.id.clone())
        };
        if let Some(job_id) = unfinished {
            emit(
                &app_reader,
                AnalysisEvent::Error {
                    job_id: Some(job_id),
                    message: "Analysis agent stopped unexpectedly.".into(),
                },
            );
            let mut guard = analysis_state.job.lock().unwrap_or_else(|p| p.into_inner());
            *guard = None;
        }
        let mut proc_guard = analysis_state
            .process
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        *proc_guard = None;
    });

    let _ = send_command(
        state,
        json!({
            "type": "set_model",
            "provider": provider,
            "modelId": model,
        }),
        Duration::from_secs(20),
    );

    Ok(())
}

fn send_command(
    state: &AnalysisState,
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
            .ok_or_else(|| "Analysis agent is not running.".to_string())?;
        let line = serde_json::to_string(&command)
            .map_err(|error| format!("Could not encode command: {error}"))?;
        writeln!(proc.stdin, "{line}")
            .map_err(|error| format!("Could not write to analysis agent: {error}"))?;
        proc.stdin
            .flush()
            .map_err(|error| format!("Could not flush analysis agent stdin: {error}"))?;
    }

    match rx.recv_timeout(timeout) {
        Ok(result) => result,
        Err(_) => {
            state
                .pending
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .remove(&id);
            Err("Analysis agent timed out.".into())
        }
    }
}

fn connected_toolkits(user_id: Option<&str>) -> Vec<String> {
    let Some(user_id) = user_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return Vec::new();
    };
    match tauri::async_runtime::block_on(crate::composio::list_composio_connected_accounts(
        user_id.to_string(),
    )) {
        Ok(response) => {
            let mut slugs: Vec<String> = response
                .items
                .into_iter()
                .filter(|item| {
                    let status = item.status.to_ascii_uppercase();
                    status == "ACTIVE" || status == "CONNECTED" || status.is_empty()
                })
                .map(|item| item.toolkit_slug)
                .filter(|slug| !slug.trim().is_empty())
                .collect();
            slugs.sort();
            slugs.dedup();
            slugs
        }
        Err(error) => {
            eprintln!("[analysis] could not list connected accounts: {error}");
            Vec::new()
        }
    }
}

fn build_prompt(
    kind: AnalysisKind,
    start_date: &str,
    end_date: &str,
    job_id: &str,
    time_zone: &str,
    local_time: &str,
    connected_toolkits: &[String],
    composio_attached: bool,
) -> String {
    let job_path = JarbasPaths::analysis_job_file(job_id);
    let db_path = JarbasPaths::root().join("db.sqlite");
    let period = format_period(start_date, end_date);

    let schema = match kind {
        AnalysisKind::Learnings => r#"
Write a JSON object to the job file with shape:
{
  "items": [
    {
      "id": "kebab-case-id",
      "title": string,
      "category": string,
      "observed": string,
      "insight": string,
      "apps": string[],
      "frequency": string,
      "firstSeen": string,
      "lastSeen": string,
      "confidence": "High" | "Medium" | "Low",
      "evidence": string[],
      "steps": string[],
      "relatedOpportunity": string,
      "nextAction": string,
      "timePattern": string
    }
  ]
}
Produce 3–8 learnings grounded in evidence. Focus on how the person works, thinks, sequences tasks, switches context, and forms rituals. Merge screen capture with connected-app activity into one coherent picture.
"#,
        AnalysisKind::Opportunities => r#"
Write a JSON object to the job file with shape:
{
  "items": [
    {
      "id": "kebab-case-id",
      "title": string,
      "category": string,
      "signal": string,
      "unlock": string,
      "impact": "High" | "Medium" | "Low",
      "effort": "High" | "Medium" | "Low",
      "horizon": string,
      "apps": string[],
      "whyNow": string,
      "successMetric": string,
      "owner": string,
      "relatedLearning": string,
      "hoursSavedPerCycle": string,
      "deliveryPlan": string[],
      "prerequisites": string[],
      "risks": string[]
    }
  ]
}
Produce 3–8 opportunities. Prefer positive unlock framing and concrete delivery horizons (days/weeks). Lead with speed of delivery. Use both capture and connected-app evidence.
"#,
        AnalysisKind::Reports => r##"
Write a JSON object to the job file with shape:
{
  "report": {
    "id": "kebab-case-id",
    "title": string,
    "subtitle": string,
    "period": string,
    "person": string,
    "role": string,
    "generatedAt": string,
    "headline": string,
    "executiveBrief": string,
    "keyInsight": string,
    "deliveryUnlock": string,
    "impactOnce": string,
    "kpis": [{ "label": string, "value": string, "delta": string, "tone": "up" | "flat" | "watch" }],
    "findings": [{ "title": string, "detail": string }],
    "timeAllocation": [{ "name": string, "hours": number, "fill": "#080870" | "#8aa4c8" | "#bce2ff" | "#c5c0b0" }],
    "timeAllocationTakeaway": string,
    "dailyMix": [{ "day": string, "deepWork": number, "collaboration": number, "admin": number }],
    "dailyMixTakeaway": string,
    "focusScore": [{ "day": string, "score": number }],
    "focusTakeaway": string,
    "whatTheyDid": string[],
    "timeline": [{ "time": string, "activity": string, "type": "deep" | "collab" | "admin" }],
    "repetitiveWork": [{ "activity": string, "occurrences": number, "minutesEach": number, "automatable": boolean }],
    "bottlenecks": [{ "title": string, "cost": string, "unlock": string }],
    "opportunities": [{ "name": string, "impact": number, "effort": number, "horizon": string }],
    "improvements": string[],
    "nextSteps": [{ "action": string, "owner": string, "when": string }],
    "scorecard": [{ "label": string, "score": number, "note": string }]
  }
}
Fill every section with estimates grounded in the evidence from capture AND connected apps. Numbers may be approximate when exact timing is unavailable, but never invent apps or activities that did not appear.
"##,
    };

    let toolkit_list = if connected_toolkits.is_empty() {
        "(none listed — still try COMPOSIO_SEARCH_TOOLS to discover what is available)".to_string()
    } else {
        connected_toolkits.join(", ")
    };

    let composio_section = if composio_attached {
        format!(
            r#"Connected Composio toolkits for this user (MUST cover each one for the timeframe):
{toolkit_list}

Composio investigation (required when MCP tools are available):
- This overrides the usual "one or two tool calls" chat habit. This is a deep analysis job.
- For EVERY connected toolkit above, call COMPOSIO_SEARCH_TOOLS with a use case scoped to {period}
  (examples: "list emails from {start_date} to {end_date}", "slack messages this week",
  "calendar events between {start_date} and {end_date}", "github activity in range",
  "notion pages edited recently", "linear issues updated in range").
- Then COMPOSIO_GET_TOOL_SCHEMAS as needed and COMPOSIO_MULTI_EXECUTE_TOOL to pull the actual
  activity inside the timeframe. Prefer read/list/search tools. Never send mail, post messages,
  create issues, or mutate anything.
- If a toolkit is not connected or a call fails, note it and continue with the rest. Do not stop
  the whole analysis after one Composio failure.
- Synthesize connected-app facts with screen/OCR evidence (meetings, emails, PRs, docs, chats).
- Never bash the composio CLI. Never invent tool slugs.
"#
        )
    } else {
        format!(
            r#"Composio MCP is NOT attached for this run (missing signed-in user id or API key).
Connected toolkits known to the app (for context only): {toolkit_list}
Proceed with the fullest local capture analysis possible. Do not invent external app activity.
"#
        )
    };

    format!(
        r#"[Context: User timezone is {time_zone}. Current local time is {local_time}. Convert every date/time you show into this local timezone. Never show raw UTC ISO-8601. Audio: Jarbas does not have access to audio yet. Never mention Screenpipe or other capture vendor/SDK names. This is a background analysis job — do not chat with the user; only investigate thoroughly and write the JSON file.]

Task: Reconstruct EVERYTHING that happened during {period} (local calendar dates {start_date} through {end_date} inclusive) and produce {kind_label}.
You must combine (1) the full local capture database for that range and (2) ALL connected Composio apps for that same range. Do not stop after a shallow sample.

=== PART A — Local capture (required, exhaustive) ===
Paths:
- SQLite: {db}
- Snapshots: ~/.jarbas/data/
- Videos: ~/.jarbas/videos/

Run bash/sqlite3 across the whole timeframe. Raise limits if needed until the window is covered. Useful queries (adjust for UTC vs local if timestamps look off):
1) App/window volume:
   sqlite3 "{db}" "SELECT date(timestamp), COALESCE(app_name,''), COUNT(*) FROM frames WHERE timestamp >= '{start_date}' AND timestamp < date('{end_date}', '+1 day') GROUP BY 1,2 ORDER BY 1,3 DESC LIMIT 200;"
2) OCR / window titles / focus text (paginate if needed; do not stop at one page if more exists):
   sqlite3 "{db}" "SELECT f.timestamp, COALESCE(o.app_name,f.app_name,''), COALESCE(o.window_name,f.window_name,''), substr(COALESCE(o.text,f.full_text,f.accessibility_text,''),1,220) FROM frames f LEFT JOIN ocr_text o ON o.frame_id=f.id WHERE f.timestamp >= '{start_date}' AND f.timestamp < date('{end_date}', '+1 day') ORDER BY f.timestamp LIMIT 800;"
3) UI events / app switches / clipboard / typing:
   sqlite3 "{db}" "SELECT timestamp, event_type, COALESCE(app_name,''), COALESCE(window_title,''), COALESCE(browser_url,''), substr(COALESCE(text_content,''),1,160) FROM ui_events WHERE timestamp >= '{start_date}' AND timestamp < date('{end_date}', '+1 day') ORDER BY timestamp LIMIT 800;"
4) Meetings if present:
   sqlite3 "{db}" ".tables"
   Then query meetings / meeting_transcript_segments overlapping the range when those tables exist.
5) Memories / tags overlapping the range when present.
6) Optional: sample a few snapshot paths under ~/.jarbas/data/ only if titles/OCR are thin.

=== PART B — Connected apps via Composio (required when available) ===
{composio_section}

=== Synthesis rules ===
- Ground every claim in observed capture rows and/or Composio results. Cite apps and local times in evidence.
- Cross-link the same work across screen + email + chat + calendar + code when it is the same thread.
- If a source is empty for the range, say so in evidence and still use the other sources.
- If almost no data exists anywhere, write valid JSON with an empty items array (or a sparse report) — do not invent fake partner-billing stories.
- Prefer positive unlock framing for opportunities/reports. Avoid waste/leakage language.
- Never use emojis. Never use em dashes.
- Take the time needed. Thoroughness beats speed for this job.

Output (required):
1. Write the final JSON with the write tool to exactly this path:
   {job_path}
2. {schema}
3. After the file is written, reply with a single short line: DONE

Do not ask clarifying questions. Start with Part A, then Part B, then write the file."#,
        time_zone = time_zone,
        local_time = local_time,
        period = period,
        start_date = start_date,
        end_date = end_date,
        kind_label = kind.as_str(),
        db = db_path.display(),
        job_path = job_path.display(),
        schema = schema.trim(),
        composio_section = composio_section.trim(),
    )
}

fn list_dir_items(dir: &Path) -> Result<Vec<Value>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut items = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| format!("Could not read {}: {e}", dir.display()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let raw = match fs::read_to_string(&path) {
            Ok(raw) => raw,
            Err(_) => continue,
        };
        if let Ok(value) = serde_json::from_str::<Value>(&raw) {
            items.push(value);
        }
    }
    items.sort_by(|a, b| {
        let a_key = a
            .get("createdAt")
            .and_then(|v| v.as_str())
            .or_else(|| a.get("generatedAt").and_then(|v| v.as_str()))
            .unwrap_or("");
        let b_key = b
            .get("createdAt")
            .and_then(|v| v.as_str())
            .or_else(|| b.get("generatedAt").and_then(|v| v.as_str()))
            .unwrap_or("");
        b_key.cmp(a_key)
    });
    Ok(items)
}

#[tauri::command]
pub fn list_analysis_items(kind: String) -> Result<Vec<Value>, String> {
    let kind = AnalysisKind::parse(&kind).ok_or_else(|| format!("Unknown kind: {kind}"))?;
    JarbasPaths::ensure_directories()?;
    list_dir_items(&kind.dir())
}

#[tauri::command]
pub fn delete_analysis_item(kind: String, id: String) -> Result<(), String> {
    let kind = AnalysisKind::parse(&kind).ok_or_else(|| format!("Unknown kind: {kind}"))?;
    let id = id.trim();
    if !crate::paths::is_safe_item_id(id) {
        return Err("Invalid id.".into());
    }
    let path = kind.dir().join(format!("{id}.json"));
    if path.is_file() {
        fs::remove_file(&path).map_err(|e| format!("Could not delete {}: {e}", path.display()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn update_analysis_item(kind: String, id: String, item: Value) -> Result<Value, String> {
    let kind = AnalysisKind::parse(&kind).ok_or_else(|| format!("Unknown kind: {kind}"))?;
    let id = id.trim();
    if !crate::paths::is_safe_item_id(id) {
        return Err("Invalid id.".into());
    }
    let path = kind.dir().join(format!("{id}.json"));
    if !path.is_file() {
        return Err("Item not found.".into());
    }

    let existing_raw = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read {}: {e}", path.display()))?;
    let existing: Value = serde_json::from_str(&existing_raw)
        .map_err(|e| format!("Could not parse {}: {e}", path.display()))?;

    let mut next = item;
    let Some(obj) = next.as_object_mut() else {
        return Err("Item must be a JSON object.".into());
    };
    obj.insert("id".into(), Value::String(id.to_string()));

    // Preserve analysis transcript / job metadata unless the client sends them.
    if let Some(existing_obj) = existing.as_object() {
        for key in ["analysis", "jobId", "provider", "model", "createdAt", "startDate", "endDate"] {
            if !obj.contains_key(key) {
                if let Some(value) = existing_obj.get(key) {
                    obj.insert(key.to_string(), value.clone());
                }
            }
        }
    }

    let body = serde_json::to_string_pretty(&next)
        .map_err(|e| format!("Could not encode item: {e}"))?;
    fs::write(&path, body + "\n").map_err(|e| format!("Could not write {}: {e}", path.display()))?;
    Ok(next)
}

#[tauri::command]
pub fn get_analysis_status(app: AppHandle) -> Result<Value, String> {
    let state = app.state::<AnalysisState>();
    let job = state.job.lock().unwrap_or_else(|p| p.into_inner());
    Ok(match job.as_ref() {
        Some(job) => json!({
            "running": true,
            "jobId": job.id,
            "kind": job.kind.as_str(),
            "startDate": job.start_date,
            "endDate": job.end_date,
            "provider": job.provider,
            "model": job.model,
        }),
        None => json!({ "running": false }),
    })
}

#[tauri::command]
pub fn start_analysis(
    app: AppHandle,
    kind: String,
    start_date: String,
    end_date: String,
    time_zone: Option<String>,
    local_time: Option<String>,
    provider: Option<String>,
    model: Option<String>,
    composio_user_id: Option<String>,
) -> Result<Value, String> {
    let kind = AnalysisKind::parse(&kind).ok_or_else(|| format!("Unknown kind: {kind}"))?;
    let start_date = start_date.trim().to_string();
    let end_date = end_date.trim().to_string();
    if start_date.is_empty() || end_date.is_empty() {
        return Err("Start and end dates are required.".into());
    }
    if start_date > end_date {
        return Err("End date must be on or after start date.".into());
    }

    let state = app.state::<AnalysisState>();
    {
        let guard = state.job.lock().unwrap_or_else(|p| p.into_inner());
        if guard.is_some() {
            return Err("An analysis is already running.".into());
        }
    }

    let (llm_provider, llm_model, env_keys) = llm_settings::load_runtime_llm_with(
        provider.as_deref(),
        model.as_deref(),
    )?;

    let job_id = format!("{}-{}", kind.as_str(), now_millis());
    let tz = time_zone
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("UTC");
    let local = local_time
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("");

    let composio_user = composio_user_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let toolkits = connected_toolkits(composio_user.as_deref());
    let composio_attached = composio_user.is_some() && crate::composio_api_key().is_ok();

    stop_process(&state);
    start_process(
        &app,
        &state,
        llm_provider.as_str(),
        &llm_model,
        &env_keys,
        composio_user.as_deref(),
    )?;

    // Re-check after configure: session may have failed.
    let composio_attached = composio_attached
        && JarbasPaths::mcp_config()
            .exists()
            .then(|| fs::read_to_string(JarbasPaths::mcp_config()).ok())
            .flatten()
            .map(|raw| raw.contains("\"composio\""))
            .unwrap_or(false);

    {
        let mut guard = state.job.lock().unwrap_or_else(|p| p.into_inner());
        *guard = Some(ActiveJob {
            id: job_id.clone(),
            kind,
            start_date: start_date.clone(),
            end_date: end_date.clone(),
            provider: llm_provider.as_str().into(),
            model: llm_model.clone(),
            accumulated: String::new(),
            thinking: String::new(),
            tools: Vec::new(),
            started_at_ms: now_millis(),
            settled: false,
        });
    }

    let prompt = build_prompt(
        kind,
        &start_date,
        &end_date,
        &job_id,
        tz,
        local,
        &toolkits,
        composio_attached,
    );
    send_command(
        &state,
        json!({
            "type": "prompt",
            "message": prompt,
        }),
        Duration::from_secs(30),
    )?;

    emit(
        &app,
        AnalysisEvent::Started {
            job_id: job_id.clone(),
            kind,
        },
    );
    let status_message = if composio_attached {
        if toolkits.is_empty() {
            format!(
                "Analyzing capture + connected apps for {}…",
                kind.as_str()
            )
        } else {
            format!(
                "Analyzing capture + {} connected apps…",
                toolkits.len()
            )
        }
    } else {
        format!(
            "Analyzing local capture for {}…",
            kind.as_str()
        )
    };
    emit(
        &app,
        AnalysisEvent::Status {
            job_id: job_id.clone(),
            message: status_message,
        },
    );

    Ok(json!({
        "jobId": job_id,
        "kind": kind.as_str(),
        "provider": llm_provider.as_str(),
        "model": llm_model,
        "composioAttached": composio_attached,
        "connectedToolkits": toolkits,
    }))
}

#[tauri::command]
pub fn abort_analysis(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AnalysisState>();
    let job_id = {
        let guard = state.job.lock().unwrap_or_else(|p| p.into_inner());
        guard.as_ref().map(|job| job.id.clone())
    };
    if let Some(job_id) = &job_id {
        let _ = fs::remove_file(JarbasPaths::analysis_job_file(job_id));
    }
    stop_process(&state);
    {
        let mut guard = state.job.lock().unwrap_or_else(|p| p.into_inner());
        *guard = None;
    }
    if let Some(job_id) = job_id {
        emit(
            &app,
            AnalysisEvent::Cancelled {
                job_id,
            },
        );
    }
    Ok(())
}
