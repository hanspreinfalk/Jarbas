//! Host for `@screenpipe/sdk` via its Node JSON-line bridge.
//!
//! Capture always writes under `~/.jarbas`:
//! - MP4 sessions in `~/.jarbas/videos`
//! - paired accessibility / UI rows in `~/.jarbas/db.sqlite` (+ `data/`)

use crate::paths::JarbasPaths;
use crate::pi_agent;
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Stdio,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command},
    sync::{oneshot, Mutex},
};

const EVENT_CHANNEL: &str = "screenpipe://event";
const RPC_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Clone)]
struct HostPaths {
    node: PathBuf,
    sdk_root: PathBuf,
    bridge: PathBuf,
    /// Accessibility DB + `data/` snapshots (`~/.jarbas`).
    data_dir: PathBuf,
    /// MP4 session files (`~/.jarbas/videos`).
    videos_dir: PathBuf,
    /// Directory containing `ffmpeg` (and optionally `ffprobe`), prepended to PATH.
    ffmpeg_bin_dir: Option<PathBuf>,
}

struct BridgeChild {
    stdin: ChildStdin,
    child: Child,
}

pub struct CaptureHost {
    paths: HostPaths,
    next_id: AtomicU64,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, RpcError>>>>>,
    bridge: Mutex<Option<BridgeChild>>,
}

#[derive(Clone, Debug, serde::Deserialize)]
struct RpcError {
    name: Option<String>,
    message: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct BridgeLine {
    id: Option<u64>,
    ok: Option<bool>,
    result: Option<Value>,
    error: Option<RpcError>,
    event: Option<String>,
    data: Option<Value>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureEvent {
    event: String,
    data: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturePathsInfo {
    output_dir: String,
    data_dir: String,
    sdk_root: String,
    bridge_path: String,
    node_bin: String,
}

impl RpcError {
    fn msg(name: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            name: Some(name.into()),
            message: Some(message.into()),
        }
    }

    fn display(self) -> String {
        match (self.name, self.message) {
            (Some(name), Some(message)) => format!("{name}: {message}"),
            (Some(name), None) => name,
            (None, Some(message)) => message,
            (None, None) => "screenpipe bridge error".into(),
        }
    }
}

impl CaptureHost {
    fn new(paths: HostPaths) -> Self {
        Self {
            paths,
            next_id: AtomicU64::new(1),
            pending: Arc::new(Mutex::new(HashMap::new())),
            bridge: Mutex::new(None),
        }
    }

    fn paths_info(&self) -> CapturePathsInfo {
        CapturePathsInfo {
            output_dir: display(&self.paths.videos_dir),
            data_dir: display(&self.paths.data_dir),
            sdk_root: display(&self.paths.sdk_root),
            bridge_path: display(&self.paths.bridge),
            node_bin: display(&self.paths.node),
        }
    }

    /// Force videos into `~/.jarbas/videos` and accessibility data into `~/.jarbas`.
    fn start_params(&self, options: Option<Value>) -> Value {
        let mut map = match options {
            Some(Value::Object(map)) => map,
            _ => Map::new(),
        };

        map.insert(
            "outputDir".into(),
            Value::String(display(&self.paths.videos_dir)),
        );
        map.insert(
            "dataDir".into(),
            Value::String(display(&self.paths.data_dir)),
        );
        if !map.contains_key("filenamePrefix") && !map.contains_key("filename") {
            map.insert("filenamePrefix".into(), Value::String("jarbas".into()));
        }

        Value::Object(map)
    }

    async fn rpc<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        method: &str,
        params: Value,
    ) -> Result<Value, String> {
        self.ensure_bridge(app).await?;

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);

        let line = format!(
            "{}\n",
            json!({ "id": id, "method": method, "params": params })
        );

        let write_ok = {
            let mut guard = self.bridge.lock().await;
            match guard.as_mut() {
                Some(bridge) => bridge.stdin.write_all(line.as_bytes()).await,
                None => Err(std::io::Error::new(
                    std::io::ErrorKind::BrokenPipe,
                    "capture bridge is not running",
                )),
            }
        };

        if let Err(error) = write_ok {
            self.pending.lock().await.remove(&id);
            self.bridge.lock().await.take();
            return Err(format!("failed to talk to screenpipe bridge: {error}"));
        }

        tokio::time::timeout(RPC_TIMEOUT, rx)
            .await
            .map_err(|_| format!("screenpipe `{method}` timed out"))?
            .map_err(|_| "screenpipe bridge closed mid-call".to_string())?
            .map_err(RpcError::display)
    }

    async fn ensure_bridge<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), String> {
        let mut guard = self.bridge.lock().await;
        if guard.is_some() {
            return Ok(());
        }

        if !self.paths.bridge.is_file() {
            return Err(format!(
                "screenpipe bridge missing at {}. Run `npm install`.",
                display(&self.paths.bridge)
            ));
        }
        if !self.paths.node.is_file() {
            return Err(format!(
                "Node runtime missing at {}. Run `npm run fetch-node`.",
                display(&self.paths.node)
            ));
        }

        JarbasPaths::ensure_directories()?;

        let mut command = Command::new(&self.paths.node);
        command
            .arg(&self.paths.bridge)
            .env("SCREENPIPE_SDK_ROOT", &self.paths.sdk_root)
            .env("SCREENPIPE_OUTPUT_DIR", &self.paths.videos_dir)
            .env("SCREENPIPE_SDK_APP_NAME", "jarbas")
            .env("SCREENPIPE_SDK_TELEMETRY", "0")
            .env(
                "PATH",
                path_with_ffmpeg_first(self.paths.ffmpeg_bin_dir.as_deref()),
            )
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let mut child = command
            .spawn()
            .map_err(|error| format!("could not start screenpipe bridge: {error}"))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "screenpipe bridge stdin unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "screenpipe bridge stdout unavailable".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "screenpipe bridge stderr unavailable".to_string())?;

        pump_stdout(app.clone(), stdout, Arc::clone(&self.pending));
        pump_stderr(app.clone(), stderr);

        *guard = Some(BridgeChild { stdin, child });
        Ok(())
    }

    async fn kill_bridge(&self) {
        let mut guard = self.bridge.lock().await;
        if let Some(mut bridge) = guard.take() {
            let _ = bridge.stdin.shutdown().await;
            let _ = bridge.child.kill().await;
            let _ = bridge.child.wait().await;
        }
    }
}

fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn resolve_sdk_root(app: &tauri::App) -> Result<PathBuf, String> {
    if let Ok(from_env) = std::env::var("SCREENPIPE_SDK_ROOT") {
        let path = PathBuf::from(from_env);
        if path.is_dir() {
            return Ok(path);
        }
        return Err(format!(
            "SCREENPIPE_SDK_ROOT does not exist: {}",
            path.display()
        ));
    }

    // Bundled layout (see scripts/stage-screenpipe-sdk.sh):
    //   Contents/Resources/resources/screenpipe/node_modules/@screenpipe/sdk
    if let Some(path) =
        pi_agent::resolve_resource(app.handle(), "screenpipe/node_modules/@screenpipe/sdk")
    {
        if path.is_dir() {
            return Ok(path);
        }
    }

    // Dev fallback: workspace node_modules next to the Tauri crate.
    let manifest_sdk = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("node_modules/@screenpipe/sdk");
    if manifest_sdk.is_dir() {
        return Ok(manifest_sdk);
    }

    Err(
        "Capture SDK is missing from this build. Rebuild with `npm run tauri:dmg`."
            .into(),
    )
}

fn resolve_ffmpeg_bin_dir(app: &tauri::App) -> Option<PathBuf> {
    if let Ok(from_env) = std::env::var("JARBAS_FFMPEG_DIR") {
        let path = PathBuf::from(from_env);
        if path.join("ffmpeg").is_file() {
            return Some(path);
        }
    }

    // Bundled: Contents/Resources/resources/ffmpeg/bin/ffmpeg
    if let Some(ffmpeg) = pi_agent::resolve_resource(app.handle(), "ffmpeg/bin/ffmpeg") {
        if ffmpeg.is_file() {
            return ffmpeg.parent().map(|p| p.to_path_buf());
        }
    }

    // Dev fallback: src-tauri/resources/ffmpeg/bin/ffmpeg
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/ffmpeg/bin/ffmpeg");
    if manifest.is_file() {
        return manifest.parent().map(|p| p.to_path_buf());
    }

    None
}

fn path_with_ffmpeg_first(ffmpeg_bin_dir: Option<&Path>) -> std::ffi::OsString {
    let mut parts: Vec<String> = Vec::new();
    if let Some(dir) = ffmpeg_bin_dir {
        parts.push(dir.display().to_string());
    }
    if let Ok(existing) = std::env::var("PATH") {
        parts.push(existing);
    }
    parts.join(":").into()
}

fn resolve_host_paths(app: &tauri::App) -> Result<HostPaths, String> {
    let node = pi_agent::find_node(app.handle()).ok_or_else(|| {
        "Bundled Node is missing. Run `npm run fetch-node`, then restart Jarbas.".to_string()
    })?;
    let sdk_root = resolve_sdk_root(app)?;
    let bridge = std::env::var("SCREENPIPE_BRIDGE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| sdk_root.join("bridges/node-json-session.mjs"));
    if !bridge.is_file() {
        return Err(format!("capture bridge missing at {}", bridge.display()));
    }
    let capture_root = JarbasPaths::capture_dir();
    let videos_dir = JarbasPaths::videos_dir();
    std::fs::create_dir_all(&capture_root)
        .map_err(|error| format!("could not create {}: {error}", capture_root.display()))?;
    std::fs::create_dir_all(&videos_dir)
        .map_err(|error| format!("could not create {}: {error}", videos_dir.display()))?;
    let ffmpeg_bin_dir = resolve_ffmpeg_bin_dir(app);

    Ok(HostPaths {
        node,
        sdk_root,
        bridge,
        data_dir: capture_root,
        videos_dir,
        ffmpeg_bin_dir,
    })
}

fn pump_stdout<R: Runtime>(
    app: AppHandle<R>,
    stdout: ChildStdout,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, RpcError>>>>>,
) {
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        loop {
            match lines.next_line().await {
                Ok(Some(line)) => handle_line(&app, &pending, &line).await,
                Ok(None) => break,
                Err(error) => {
                    emit_bridge_error(&app, "stdout", error.to_string(), true);
                    break;
                }
            }
        }

        let mut pending = pending.lock().await;
        for (_, tx) in pending.drain() {
            let _ = tx.send(Err(RpcError::msg(
                "BridgeExited",
                "screenpipe bridge exited before responding",
            )));
        }
    });
}

fn pump_stderr<R: Runtime>(app: AppHandle<R>, stderr: ChildStderr) {
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if !line.trim().is_empty() {
                emit_bridge_error(&app, "stderr", line, false);
            }
        }
    });
}

async fn handle_line<R: Runtime>(
    app: &AppHandle<R>,
    pending: &Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, RpcError>>>>>,
    line: &str,
) {
    let parsed = match serde_json::from_str::<BridgeLine>(line) {
        Ok(parsed) => parsed,
        Err(error) => {
            emit_bridge_error(app, "parse", error.to_string(), false);
            return;
        }
    };

    if let Some(id) = parsed.id {
        let response = if parsed.ok == Some(true) {
            Ok(parsed.result.unwrap_or(Value::Null))
        } else {
            Err(parsed
                .error
                .unwrap_or_else(|| RpcError::msg("BridgeError", "screenpipe call failed")))
        };
        if let Some(tx) = pending.lock().await.remove(&id) {
            let _ = tx.send(response);
        }
        return;
    }

    if let Some(event) = parsed.event {
        let _ = app.emit(
            EVENT_CHANNEL,
            CaptureEvent {
                event,
                data: parsed.data.unwrap_or(Value::Null),
            },
        );
    }
}

fn emit_bridge_error<R: Runtime>(
    app: &AppHandle<R>,
    component: impl Into<String>,
    message: impl Into<String>,
    fatal: bool,
) {
    let _ = app.emit(
        EVENT_CHANNEL,
        CaptureEvent {
            event: "error".into(),
            data: json!({
                "component": component.into(),
                "name": "ScreenpipeBridge",
                "message": message.into(),
                "fatal": fatal,
            }),
        },
    );
}

pub fn init_host(app: &tauri::App) -> Result<(), String> {
    let paths = resolve_host_paths(app)?;
    app.manage(Arc::new(CaptureHost::new(paths)));
    Ok(())
}

#[tauri::command]
pub async fn screenpipe_default_paths(
    state: State<'_, Arc<CaptureHost>>,
) -> Result<CapturePathsInfo, String> {
    Ok(state.paths_info())
}

#[tauri::command]
pub async fn screenpipe_permissions<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<CaptureHost>>,
    options: Option<Value>,
) -> Result<Value, String> {
    state
        .rpc(&app, "permissions", options.unwrap_or_else(|| json!({})))
        .await
}

#[tauri::command]
pub async fn screenpipe_start<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<CaptureHost>>,
    options: Option<Value>,
) -> Result<Value, String> {
    state
        .rpc(&app, "start", state.start_params(options))
        .await
}

#[tauri::command]
pub async fn screenpipe_stop<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<CaptureHost>>,
) -> Result<Value, String> {
    // Stop capture, dispose the session, then kill the Node child so macOS
    // clears the purple ScreenCaptureKit indicator.
    let status = state.rpc(&app, "stop", json!({})).await;
    let _ = state.rpc(&app, "dispose", json!({})).await;
    state.kill_bridge().await;
    status
}

#[tauri::command]
pub async fn screenpipe_status<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<CaptureHost>>,
) -> Result<Value, String> {
    state.rpc(&app, "status", json!({})).await
}

#[tauri::command]
pub async fn screenpipe_snapshot<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<CaptureHost>>,
) -> Result<Value, String> {
    state.rpc(&app, "snapshot", json!({})).await
}

#[tauri::command]
pub async fn screenpipe_reveal<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<CaptureHost>>,
    file: Option<String>,
) -> Result<bool, String> {
    let target = match file.filter(|value| !value.is_empty()) {
        Some(path) => path,
        None => {
            let status = state.rpc(&app, "status", json!({})).await?;
            status
                .get("output")
                .and_then(Value::as_str)
                .map(str::to_owned)
                .unwrap_or_else(|| display(&JarbasPaths::capture_dir()))
        }
    };

    reveal_in_finder(&target)?;
    Ok(true)
}

#[tauri::command]
pub async fn screenpipe_dispose<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<CaptureHost>>,
) -> Result<bool, String> {
    let _ = state.rpc(&app, "dispose", json!({})).await;
    state.kill_bridge().await;
    Ok(true)
}

#[tauri::command]
pub async fn screenpipe_events<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<CaptureHost>>,
) -> Result<Value, String> {
    state.rpc(&app, "events", json!({})).await
}

#[tauri::command]
pub async fn screenpipe_identify(_options: Option<Value>) -> Result<bool, String> {
    Ok(true)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastCaptureSession {
    /// Session start as RFC3339 / ISO-8601 (UTC).
    started_at: String,
    /// Session end as RFC3339 / ISO-8601 (UTC).
    ended_at: String,
    duration_ms: u64,
    frame_count: u64,
}

#[tauri::command]
pub async fn capture_last_session() -> Result<Option<LastCaptureSession>, String> {
    Ok(read_last_capture_session())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStorageStats {
    root: String,
    bytes: u64,
    frames: u64,
}

#[tauri::command]
pub async fn capture_storage_stats() -> Result<CaptureStorageStats, String> {
    let root = JarbasPaths::root();
    let bytes = dir_size_bytes(&root).unwrap_or(0);
    let frames = count_frames_in_db(&root.join("db.sqlite")).unwrap_or(0);
    Ok(CaptureStorageStats {
        root: display(&root),
        bytes,
        frames,
    })
}

fn dir_size_bytes(path: &Path) -> std::io::Result<u64> {
    let mut total = 0u64;
    let mut stack = vec![path.to_path_buf()];
    while let Some(current) = stack.pop() {
        let entries = match std::fs::read_dir(&current) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let meta = match entry.metadata() {
                Ok(meta) => meta,
                Err(_) => continue,
            };
            if meta.is_dir() {
                stack.push(entry.path());
            } else {
                total = total.saturating_add(meta.len());
            }
        }
    }
    Ok(total)
}

fn count_frames_in_db(db: &Path) -> Option<u64> {
    if !db.is_file() {
        return Some(0);
    }
    let output = std::process::Command::new("sqlite3")
        .arg(db)
        .arg("SELECT COUNT(*) FROM frames;")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .ok()
}

fn read_last_capture_session() -> Option<LastCaptureSession> {
    // Prefer MP4 session files — they map 1:1 to recording presses.
    // The frames table spans *all* capture ever, so MIN/MAX is wrong for "last session".
    read_last_session_from_mp4().or_else(read_last_session_from_db)
}

fn read_last_session_from_db() -> Option<LastCaptureSession> {
    let db = JarbasPaths::root().join("db.sqlite");
    if !db.is_file() {
        return None;
    }

    // Last contiguous run of frames: a gap > SESSION_GAP_SECS starts a new session.
    const SESSION_GAP_SECS: i64 = 120;
    let sql = format!(
        "
WITH ordered AS (
  SELECT timestamp AS ts,
         LAG(timestamp) OVER (ORDER BY timestamp) AS prev
  FROM frames
),
boundaries AS (
  SELECT ts AS started_at
  FROM ordered
  WHERE prev IS NULL
     OR (julianday(ts) - julianday(prev)) * 86400.0 > {SESSION_GAP_SECS}
),
last_start AS (
  SELECT MAX(started_at) AS started_at FROM boundaries
)
SELECT last_start.started_at,
       MAX(frames.timestamp),
       COUNT(*)
FROM frames
JOIN last_start ON frames.timestamp >= last_start.started_at;
"
    );

    let output = std::process::Command::new("sqlite3")
        .arg(&db)
        .arg(sql)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let line = String::from_utf8_lossy(&output.stdout);
    let line = line.trim();
    if line.is_empty() || line.starts_with('|') || line == "||0" {
        return None;
    }

    let mut parts = line.split('|');
    let started_at = parts.next()?.trim();
    let ended_at = parts.next()?.trim();
    let frame_count: u64 = parts.next()?.trim().parse().ok()?;
    if frame_count == 0 || started_at.is_empty() || ended_at.is_empty() {
        return None;
    }

    let start_ms = parse_iso_millis(started_at)?;
    let end_ms = parse_iso_millis(ended_at)?;
    if end_ms < start_ms {
        return None;
    }

    Some(LastCaptureSession {
        started_at: started_at.to_string(),
        ended_at: ended_at.to_string(),
        duration_ms: end_ms.saturating_sub(start_ms),
        frame_count,
    })
}

fn read_last_session_from_mp4() -> Option<LastCaptureSession> {
    let root = JarbasPaths::videos_dir();
    let entries = std::fs::read_dir(&root).ok()?;

    let mut best: Option<(String, u64, std::time::SystemTime)> = None;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with("jarbas-") || !name.ends_with(".mp4") {
            continue;
        }
        let Some(stem) = session_stem_from_mp4(&name) else {
            continue;
        };
        let modified = entry.metadata().ok()?.modified().ok()?;
        match &best {
            Some((_, _, best_mod)) if modified <= *best_mod => {}
            _ => {
                let start_ms = parse_mp4_stem_millis(&stem)?;
                best = Some((stem, start_ms, modified));
            }
        }
    }

    let (_stem, start_ms, modified) = best?;
    let end_ms = modified
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_millis() as u64;

    Some(LastCaptureSession {
        started_at: format_millis_iso(start_ms),
        ended_at: format_millis_iso(end_ms),
        duration_ms: end_ms.saturating_sub(start_ms),
        frame_count: 0,
    })
}

fn session_stem_from_mp4(name: &str) -> Option<String> {
    let without_ext = name.strip_suffix(".mp4")?;
    let stem = without_ext
        .rsplit_once("-monitor-")
        .map(|(prefix, _)| prefix)
        .unwrap_or(without_ext);
    stem.strip_prefix("jarbas-").map(str::to_owned)
}

/// `2026-08-06T23-41-18-142Z` → millis since epoch.
fn parse_mp4_stem_millis(stem: &str) -> Option<u64> {
    // YYYY-MM-DDTHH-MM-SS-mmmZ
    let (date, rest) = stem.split_once('T')?;
    let rest = rest.strip_suffix('Z').unwrap_or(rest);
    let parts: Vec<&str> = rest.split('-').collect();
    if parts.len() < 4 {
        return None;
    }
    let iso = format!(
        "{date}T{:0>2}:{:0>2}:{:0>2}.{}Z",
        parts[0], parts[1], parts[2], parts[3]
    );
    parse_iso_millis(&iso)
}

fn parse_iso_millis(value: &str) -> Option<u64> {
    // Accept `2026-08-06T23:41:21.317007+00:00` and `...Z`.
    let normalized = value.trim().replace("+00:00", "Z");
    let normalized = if normalized.ends_with('Z') {
        normalized
    } else {
        format!("{normalized}Z")
    };

    // Split date / time
    let (date, time) = normalized.split_once('T')?;
    let time = time.trim_end_matches('Z');
    let (hms, frac) = match time.split_once('.') {
        Some((hms, frac)) => (hms, Some(frac)),
        None => (time, None),
    };
    let mut hms_parts = hms.split(':');
    let hour: u32 = hms_parts.next()?.parse().ok()?;
    let minute: u32 = hms_parts.next()?.parse().ok()?;
    let second: u32 = hms_parts.next()?.parse().ok()?;
    let mut date_parts = date.split('-');
    let year: i32 = date_parts.next()?.parse().ok()?;
    let month: u32 = date_parts.next()?.parse().ok()?;
    let day: u32 = date_parts.next()?.parse().ok()?;

    let mut millis: u64 = 0;
    if let Some(frac) = frac {
        let digits: String = frac.chars().filter(|c| c.is_ascii_digit()).take(3).collect();
        if !digits.is_empty() {
            let padded = format!("{:0<3}", digits);
            millis = padded.parse().unwrap_or(0);
        }
    }

    let days = days_from_civil(year, month, day)?;
    let seconds = days
        .checked_mul(86_400)?
        .checked_add(i64::from(hour) * 3600)?
        .checked_add(i64::from(minute) * 60)?
        .checked_add(i64::from(second))?;
    if seconds < 0 {
        return None;
    }
    Some((seconds as u64).saturating_mul(1000).saturating_add(millis))
}

fn format_millis_iso(ms: u64) -> String {
    let seconds = (ms / 1000) as i64;
    let millis = ms % 1000;
    let (year, month, day) = civil_from_days(seconds.div_euclid(86_400));
    let tod = seconds.rem_euclid(86_400) as u32;
    let hour = tod / 3600;
    let minute = (tod % 3600) / 60;
    let second = tod % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

/// Howard Hinnant civil-from-days / days-from-civil (proleptic Gregorian).
fn days_from_civil(year: i32, month: u32, day: u32) -> Option<i64> {
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = (y - era * 400) as u32;
    let mp = if month > 2 { month - 3 } else { month + 9 };
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(i64::from(era) * 146_097 + i64::from(doe) - 719_468)
}

fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = (z - era * 146_097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = (yoe as i32) + (era as i32) * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { y + 1 } else { y };
    (year, month, day)
}

fn reveal_in_finder(path: &str) -> Result<(), String> {
    let target = Path::new(path);
    let fallback = target.parent().unwrap_or(target);

    #[cfg(target_os = "macos")]
    {
        let mut command = std::process::Command::new("open");
        if target.exists() {
            command.arg("-R").arg(target);
        } else {
            command.arg(fallback);
        }
        command
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("could not reveal capture path: {error}"))
    }

    #[cfg(not(target_os = "macos"))]
    {
        let mut command = std::process::Command::new("xdg-open");
        command.arg(if target.exists() { target } else { fallback });
        command
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("could not reveal capture path: {error}"))
    }
}
