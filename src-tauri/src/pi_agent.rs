use crate::paths::JarbasPaths;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State};

pub const PI_PACKAGE_VERSION: &str = "0.83.0";
pub const MCP_ADAPTER_VERSION: &str = "2.19.0";

const APPEND_SYSTEM: &str = include_str!("../resources/pi/APPEND_SYSTEM.md");
const JARBAS_SKILL: &str = include_str!("../resources/pi/skills/jarbas/SKILL.md");
const COMPOSIO_SKILL: &str = include_str!("../resources/pi/skills/composio/SKILL.md");

/// Injected into APPEND_SYSTEM + Composio skill only when the user has connectors.
const CONNECTORS_READ_ONLY_APPEND: &str = r#"
## Connected apps (read-only)

This user has connected external apps. You may **only read** them: fetch, search,
list, or summarize. Never send email, post messages, create/update/delete issues
or docs, or otherwise mutate anything in Gmail, Slack, GitHub, Notion, Calendar,
or any other connected app. If the user asks you to write or change something
there, refuse and tell them to do it in the app themselves.
"#;

const CONNECTORS_READ_ONLY_COMPOSIO: &str = r#"
## Read-only (mandatory)

This user has connected apps. Jarbas may **only read** them.

Allowed: search, fetch, list, get, summarize.

Forbidden: send, reply, forward, post, create, update, edit, delete, archive,
invite, share, upload, or any other mutating action.

If the user asks to write or change something in a connected app, refuse clearly.
When searching for tools, prefer read use cases
(example: `read recent Gmail emails`). Never search for send/create/delete actions.
Never call write tools.
"#;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PiAgentStatus {
    Idle,
    #[serde(rename_all = "camelCase")]
    Installing { message: String },
    Ready,
    #[serde(rename_all = "camelCase")]
    Failed { message: String },
}

pub struct PiAgentState {
    inner: Mutex<PiAgentStatus>,
}

impl Default for PiAgentState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(PiAgentStatus::Idle),
        }
    }
}

impl PiAgentState {
    pub fn get(&self) -> PiAgentStatus {
        self.inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    fn set(&self, status: PiAgentStatus) {
        *self
            .inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = status;
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PiAgentInfo {
    pub status: PiAgentStatus,
    pub root: String,
    pub pi_cli: String,
    pub installed: bool,
    pub node: Option<String>,
}

pub fn is_installed() -> bool {
    JarbasPaths::pi_cli().is_file()
}

pub fn current_info(app: &AppHandle, state: &PiAgentState) -> PiAgentInfo {
    let mut status = state.get();
    if matches!(status, PiAgentStatus::Idle) && is_installed() {
        status = PiAgentStatus::Ready;
        state.set(status.clone());
    }
    PiAgentInfo {
        status,
        root: JarbasPaths::root().display().to_string(),
        pi_cli: JarbasPaths::pi_cli().display().to_string(),
        installed: is_installed(),
        node: find_node(app).map(|path| path.display().to_string()),
    }
}

pub fn spawn_ensure_installed(app: AppHandle, force: bool) {
    {
        let state = app.state::<PiAgentState>();
        if matches!(state.get(), PiAgentStatus::Installing { .. }) {
            return;
        }
        if !force && is_installed() {
            if let Err(error) = write_config_files(&app) {
                emit_status(&app, PiAgentStatus::Failed { message: error });
                return;
            }
            sanitize_optional_native_addons();
            emit_status(&app, PiAgentStatus::Ready);
            return;
        }
    }

    emit_status(
        &app,
        PiAgentStatus::Installing {
            message: "Preparing…".into(),
        },
    );

    std::thread::spawn(move || match run_install(&app, force) {
        Ok(()) => emit_status(&app, PiAgentStatus::Ready),
        Err(error) => {
            if is_installed() {
                let _ = write_config_files(&app);
                sanitize_optional_native_addons();
                emit_status(&app, PiAgentStatus::Ready);
            } else {
                emit_status(&app, PiAgentStatus::Failed { message: error });
            }
        }
    });
}

fn emit_status(app: &AppHandle, status: PiAgentStatus) {
    app.state::<PiAgentState>().set(status.clone());
    let _ = app.emit("pi-agent-status", &status);
}

fn run_install(app: &AppHandle, force: bool) -> Result<(), String> {
    JarbasPaths::ensure_directories()?;

    if !force && is_installed() {
        write_config_files(app)?;
        sanitize_optional_native_addons();
        return Ok(());
    }

    let node = find_node(app).ok_or_else(|| {
        "Bundled Node runtime is missing from this build. Run `npm run fetch-node`, then rebuild Jarbas."
            .to_string()
    })?;
    let npm = find_npm(app, &node)?;

    emit_status(
        app,
        PiAgentStatus::Installing {
            message: "Writing package manifests…".into(),
        },
    );
    write_agent_package_json()?;
    write_npmrc_files()?;
    write_native_addon_stubs()?;
    sanitize_optional_native_addons();

    emit_status(
        app,
        PiAgentStatus::Installing {
            message: "Installing Pi agent…".into(),
        },
    );
    run_npm(
        &node,
        &npm,
        &[
            "install",
            "--omit=dev",
            "--omit=optional",
            "--ignore-scripts",
            "--no-fund",
            "--no-audit",
        ],
        &JarbasPaths::pi_agent(),
    )?;

    sanitize_optional_native_addons();

    emit_status(
        app,
        PiAgentStatus::Installing {
            message: "Finishing…".into(),
        },
    );
    write_config_files(app)?;

    if !is_installed() {
        return Err("Pi agent CLI missing after install.".into());
    }
    Ok(())
}

fn write_agent_package_json() -> Result<(), String> {
    let json = serde_json::json!({
        "name": "jarbas-pi-agent",
        "private": true,
        "dependencies": {
            "@earendil-works/pi-coding-agent": PI_PACKAGE_VERSION,
            "pi-mcp-adapter": MCP_ADAPTER_VERSION,
        },
        "overrides": {
            "@mariozechner/clipboard": "file:jarbas-stubs/clipboard",
            "@napi-rs/keyring": "file:jarbas-stubs/keyring",
        },
    });
    write_pretty_json(&JarbasPaths::package_json(), &json)
}

fn write_npmrc_files() -> Result<(), String> {
    let body = "\
optional=false
ignore-scripts=true
fund=false
audit=false
update-notifier=false
";
    let path = JarbasPaths::pi_agent().join(".npmrc");
    std::fs::write(&path, body)
        .map_err(|error| format!("Could not write {}: {error}", path.display()))
}

fn write_native_addon_stubs() -> Result<(), String> {
    let stubs = JarbasPaths::pi_agent().join("jarbas-stubs");
    write_stub_package(
        &stubs.join("clipboard"),
        "@mariozechner/clipboard",
        "Jarbas: native clipboard disabled",
    )?;
    write_stub_package(
        &stubs.join("keyring"),
        "@napi-rs/keyring",
        "Jarbas: native keyring disabled",
    )?;
    Ok(())
}

fn write_stub_package(dir: &Path, name: &str, error_message: &str) -> Result<(), String> {
    std::fs::create_dir_all(dir)
        .map_err(|error| format!("Could not create {}: {error}", dir.display()))?;
    let package = serde_json::json!({
        "name": name,
        "version": "0.0.0-jarbas-stub",
        "main": "index.js",
        "license": "UNLICENSED",
    });
    write_pretty_json(&dir.join("package.json"), &package)?;
    let index = format!(
        "// Jarbas stub - real NAPI binary intentionally omitted.\nthrow new Error({error_message:?});\n"
    );
    std::fs::write(dir.join("index.js"), index)
        .map_err(|error| format!("Could not write stub index.js: {error}"))
}

fn write_config_files(app: &AppHandle) -> Result<(), String> {
    JarbasPaths::ensure_directories()?;
    // Default: no connector read-only rules (Ask/analysis refresh when connectors exist).
    write_connector_prompt_files(false)?;
    std::fs::write(JarbasPaths::jarbas_skill_file(), JARBAS_SKILL)
        .map_err(|error| format!("Could not write jarbas skill: {error}"))?;
    ensure_composio_cli_on_path()?;

    let node = find_node(app)
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| "bundled-node-missing".into());

    // Base MCP file; Ask process rewrites this with a per-user Tool Router session.
    let mcp = serde_json::json!({
        "settings": {
            "directTools": true,
            "toolPrefix": "none",
        },
        "mcpServers": {},
        "note": format!("Bundled Node for MCP bridges: {node}. Composio MCP is attached per Ask session."),
    });
    write_pretty_json(&JarbasPaths::mcp_config(), &mcp)?;

    let settings = serde_json::json!({
        "packages": ["npm:pi-mcp-adapter"],
        "skills": [
            JarbasPaths::jarbas_skill_dir().display().to_string(),
            JarbasPaths::composio_skill_dir().display().to_string(),
        ],
        "enableSkillCommands": true,
    });
    write_pretty_json(&JarbasPaths::settings_config(), &settings)?;

    let cache = JarbasPaths::pi_config().join("mcp-cache.json");
    let _ = std::fs::remove_file(cache);
    Ok(())
}

/// Write APPEND_SYSTEM + Composio skill. Read-only connector rules only when
/// `has_connectors` is true.
pub fn write_connector_prompt_files(has_connectors: bool) -> Result<(), String> {
    JarbasPaths::ensure_directories()?;

    let append = if has_connectors {
        format!("{}\n{}", APPEND_SYSTEM.trim_end(), CONNECTORS_READ_ONLY_APPEND.trim_start())
    } else {
        APPEND_SYSTEM.to_string()
    };
    std::fs::write(JarbasPaths::append_system(), append)
        .map_err(|error| format!("Could not write APPEND_SYSTEM.md: {error}"))?;

    let composio = if has_connectors {
        format!(
            "{}\n{}",
            COMPOSIO_SKILL.trim_end(),
            CONNECTORS_READ_ONLY_COMPOSIO.trim_start()
        )
    } else {
        COMPOSIO_SKILL.to_string()
    };
    std::fs::write(JarbasPaths::composio_skill_file(), composio)
        .map_err(|error| format!("Could not write composio skill: {error}"))?;

    Ok(())
}

/// Ensure an app-owned `composio` CLI under `~/.jarbas` (never `~/.composio`).
fn ensure_composio_cli_on_path() -> Result<(), String> {
    JarbasPaths::ensure_directories()?;
    remove_personal_composio_link()?;

    #[cfg(windows)]
    {
        // Tool Router MCP does not need the local CLI binary.
        let _ = install_app_owned_composio_cli();
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        let binary = JarbasPaths::composio_cli_binary();
        let entry = JarbasPaths::composio_cli();
        if is_app_owned_composio(&binary, &entry) {
            return Ok(());
        }

        install_app_owned_composio_cli()?;

        if !is_app_owned_composio(&binary, &entry) {
            return Err(
                "Composio CLI install finished but ~/.jarbas/bin/composio is missing or still points outside ~/.jarbas."
                    .into(),
            );
        }
        Ok(())
    }
}

#[cfg(not(windows))]
fn is_app_owned_composio(binary: &Path, entry: &Path) -> bool {
    if !binary.is_file() {
        return false;
    }
    // Prefer the real binary in composio-cli/. Entry may be the same path or a
    // symlink into that tree — but never a link into ~/.composio.
    if entry.is_symlink() {
        if let Ok(target) = std::fs::read_link(entry) {
            let resolved = if target.is_absolute() {
                target
            } else {
                entry
                    .parent()
                    .unwrap_or_else(|| Path::new("."))
                    .join(target)
            };
            let root = JarbasPaths::root();
            return resolved.starts_with(&root) && resolved.is_file();
        }
        return false;
    }
    entry.exists() && entry.starts_with(JarbasPaths::root())
}

fn remove_personal_composio_link() -> Result<(), String> {
    let entry = JarbasPaths::composio_cli();
    if !entry.exists() && !entry.is_symlink() {
        return Ok(());
    }

    let outside_jarbas = if entry.is_symlink() {
        match std::fs::read_link(&entry) {
            Ok(target) => {
                let resolved = if target.is_absolute() {
                    target
                } else {
                    entry
                        .parent()
                        .unwrap_or_else(|| Path::new("."))
                        .join(target)
                };
                !resolved.starts_with(JarbasPaths::root())
            }
            Err(_) => true,
        }
    } else {
        // Hard file in bin/: keep only if it lives under ~/.jarbas (it does by path).
        false
    };

    if outside_jarbas {
        let _ = std::fs::remove_file(&entry);
    }
    Ok(())
}

fn install_app_owned_composio_cli() -> Result<(), String> {
    #[cfg(windows)]
    {
        // Local Composio CLI installer is bash-based; Ask/analysis use Tool Router MCP
        // and do not require the binary on Windows.
        eprintln!("[pi] skipping Composio CLI binary install on Windows");
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        let install_dir = JarbasPaths::composio_cli_dir();
        let bin_dir = JarbasPaths::bin_dir();
        std::fs::create_dir_all(&install_dir)
            .map_err(|error| format!("Could not create {}: {error}", install_dir.display()))?;
        std::fs::create_dir_all(&bin_dir)
            .map_err(|error| format!("Could not create {}: {error}", bin_dir.display()))?;

        // Official installer: downloads a self-contained binary into INSTALL_DIR
        // and puts an entry point in BIN_DIR. Never touches the user's ~/.composio.
        let status = Command::new("bash")
            .arg("-lc")
            .arg("curl -fsSL https://composio.dev/install | bash")
            .env("COMPOSIO_INSTALL_DIR", &install_dir)
            .env("COMPOSIO_BIN_DIR", &bin_dir)
            .env("COMPOSIO_INSTALL_SHELL", "none")
            .env("COMPOSIO_INSTALL_HELP", "0")
            .env("COMPOSIO_INSTALL_PLUGINS", "0")
            .env("COMPOSIO_QUIET", "1")
            .env("HOME", JarbasPaths::home())
            .status()
            .map_err(|error| format!("Failed to run Composio installer: {error}"))?;

        if !status.success() {
            return Err(format!(
                "Composio installer exited with status {}. Need network access to composio.dev.",
                status.code().unwrap_or(-1)
            ));
        }

        Ok(())
    }
}

fn write_pretty_json(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }
    let body = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Could not encode JSON for {}: {error}", path.display()))?;
    std::fs::write(path, body + "\n")
        .map_err(|error| format!("Could not write {}: {error}", path.display()))
}

/// Resolve a path under the app resource dir.
///
/// Tauri copies config entries like `resources/nodejs/` to
/// `Contents/Resources/resources/nodejs/...`, so we try both the short name
/// (`nodejs/...`) and the prefixed name (`resources/nodejs/...`).
pub fn resolve_resource(app: &AppHandle, relative: &str) -> Option<PathBuf> {
    let candidates = [
        relative.to_string(),
        format!("resources/{relative}"),
    ];
    for candidate in candidates {
        if let Ok(path) = app.path().resolve(&candidate, BaseDirectory::Resource) {
            if path.exists() {
                return Some(path);
            }
        }
    }
    None
}

/// Prefer the Node binary shipped inside the app bundle / resources tree.
pub fn find_node(app: &AppHandle) -> Option<PathBuf> {
    let relative_candidates = [
        #[cfg(windows)]
        "nodejs/bin/node.exe",
        #[cfg(not(windows))]
        "nodejs/bin/node",
        // Dev/fallback names if a unix layout is checked out on Windows or vice versa.
        "nodejs/bin/node",
        "nodejs/bin/node.exe",
    ];

    for relative in relative_candidates {
        if let Some(path) = resolve_resource(app, relative) {
            if path.is_file() {
                return Some(path);
            }
        }
    }

    // Dev fallback: resources live next to the Tauri crate before bundling.
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/nodejs/bin");
    for name in ["node.exe", "node"] {
        let candidate = manifest.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn find_npm(app: &AppHandle, node: &Path) -> Result<PathBuf, String> {
    if let Some(path) = resolve_resource(app, "nodejs/lib/node_modules/npm/bin/npm-cli.js") {
        if path.is_file() {
            return Ok(path);
        }
    }

    let bundled_cli = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources/nodejs/lib/node_modules/npm/bin/npm-cli.js");
    if bundled_cli.is_file() {
        return Ok(bundled_cli);
    }

    // Official Node layout: npm-cli.js next to ../lib from bin/node.
    let beside = node
        .parent() // bin
        .and_then(|bin| bin.parent()) // nodejs
        .map(|root| root.join("lib/node_modules/npm/bin/npm-cli.js"))
        .filter(|path| path.is_file());
    if let Some(path) = beside {
        return Ok(path);
    }

    Err("Bundled npm-cli.js is missing. Run `npm run fetch-node`, then rebuild.".into())
}

fn run_npm(node: &Path, npm: &Path, args: &[&str], cwd: &Path) -> Result<(), String> {
    let mut command = if npm.extension().and_then(|ext| ext.to_str()) == Some("js") {
        let mut cmd = Command::new(node);
        cmd.arg(npm);
        cmd.args(args);
        cmd
    } else {
        let mut cmd = Command::new(npm);
        cmd.args(args);
        cmd
    };

    let path = augmented_path(node);
    command
        .current_dir(cwd)
        .env("npm_config_cache", JarbasPaths::npm_cache())
        .env("npm_config_fund", "false")
        .env("npm_config_audit", "false")
        .env("npm_config_update_notifier", "false")
        .env("npm_config_ignore_scripts", "true")
        .env("npm_config_optional", "false")
        .env("PATH", path);

    let output = command
        .output()
        .map_err(|error| format!("Failed to run npm: {error}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    Err(summarize_npm_failure(output.status.code(), &stderr, &stdout))
}

fn augmented_path(node: &Path) -> std::ffi::OsString {
    let mut prefer = Vec::new();
    if let Some(bin) = node.parent() {
        prefer.push(bin.to_path_buf());
    }
    prefer.push(JarbasPaths::bin_dir());
    crate::paths::child_path_env(&prefer)
}

fn summarize_npm_failure(status: Option<i32>, stderr: &str, stdout: &str) -> String {
    let combined = format!("{stderr}\n{stdout}").trim().to_string();
    if combined.is_empty() {
        return format!("npm exited with status {}", status.unwrap_or(-1));
    }
    let lines: Vec<&str> = combined
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    let errors: Vec<&str> = lines
        .iter()
        .copied()
        .filter(|line| line.starts_with("npm error") || line.starts_with("npm ERR!"))
        .collect();
    if !errors.is_empty() {
        let start = errors.len().saturating_sub(4);
        return errors[start..].join("\n");
    }
    let useful: Vec<&str> = lines
        .into_iter()
        .filter(|line| !line.starts_with("npm warn deprecated"))
        .collect();
    let start = useful.len().saturating_sub(6);
    useful[start..].join("\n")
}

fn sanitize_optional_native_addons() {
    let root = JarbasPaths::pi_agent();
    let Ok(entries) = walkdir_files(&root) else {
        return;
    };
    for path in entries {
        if path.extension().and_then(|ext| ext.to_str()) == Some("node") {
            let _ = std::fs::remove_file(&path);
        }
    }
}

fn walkdir_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let read = std::fs::read_dir(&dir)
            .map_err(|error| format!("Could not read {}: {error}", dir.display()))?;
        for entry in read.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else {
                files.push(path);
            }
        }
    }
    Ok(files)
}

#[tauri::command]
pub fn get_pi_agent_status(app: AppHandle, state: State<'_, PiAgentState>) -> PiAgentInfo {
    current_info(&app, &state)
}

#[tauri::command]
pub fn ensure_pi_agent_installed(
    app: AppHandle,
    force: Option<bool>,
) -> Result<PiAgentInfo, String> {
    let state = app.state::<PiAgentState>();
    spawn_ensure_installed(app.clone(), force.unwrap_or(false));
    Ok(current_info(&app, &state))
}
