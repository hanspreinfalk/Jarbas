use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};

/// On-disk layout under `~/.jarbas` for this Tauri app (not `.jarbas-main`).
pub struct JarbasPaths;

impl JarbasPaths {
    /// User home directory (`USERPROFILE` on Windows, `HOME` elsewhere).
    pub fn home() -> PathBuf {
        if let Some(home) = dirs::home_dir() {
            return home;
        }
        if let Some(profile) = std::env::var_os("USERPROFILE") {
            return PathBuf::from(profile);
        }
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home);
        }
        #[cfg(windows)]
        {
            PathBuf::from(r"C:\Temp")
        }
        #[cfg(not(windows))]
        {
            PathBuf::from("/tmp")
        }
    }

    pub fn root() -> PathBuf {
        Self::home().join(".jarbas")
    }

    /// Platform executable filename (`composio` / `composio.exe`).
    pub fn executable_name(name: &str) -> String {
        #[cfg(windows)]
        {
            if name.rsplit('.').next().is_some_and(|ext| {
                ext.eq_ignore_ascii_case("exe")
                    || ext.eq_ignore_ascii_case("cmd")
                    || ext.eq_ignore_ascii_case("bat")
            }) {
                name.to_string()
            } else {
                format!("{name}.exe")
            }
        }
        #[cfg(not(windows))]
        {
            name.to_string()
        }
    }

    pub fn pi_agent() -> PathBuf {
        Self::root().join("pi-agent")
    }

    pub fn pi_config() -> PathBuf {
        Self::root().join("pi-config")
    }

    pub fn pi_sessions() -> PathBuf {
        Self::root().join("pi-sessions")
    }

    pub fn npm_cache() -> PathBuf {
        Self::root().join("npm-cache")
    }

    pub fn pi_cli() -> PathBuf {
        Self::pi_agent().join("node_modules/@earendil-works/pi-coding-agent/dist/cli.js")
    }

    pub fn package_json() -> PathBuf {
        Self::pi_agent().join("package.json")
    }

    pub fn mcp_config() -> PathBuf {
        Self::pi_config().join("mcp.json")
    }

    pub fn settings_config() -> PathBuf {
        Self::pi_config().join("settings.json")
    }

    pub fn append_system() -> PathBuf {
        Self::pi_config().join("APPEND_SYSTEM.md")
    }

    pub fn skills_dir() -> PathBuf {
        Self::pi_config().join("skills")
    }

    pub fn jarbas_skill_dir() -> PathBuf {
        Self::skills_dir().join("jarbas")
    }

    pub fn jarbas_skill_file() -> PathBuf {
        Self::jarbas_skill_dir().join("SKILL.md")
    }

    pub fn composio_skill_dir() -> PathBuf {
        Self::skills_dir().join("composio")
    }

    pub fn composio_skill_file() -> PathBuf {
        Self::composio_skill_dir().join("SKILL.md")
    }

    /// App-owned Composio Universal CLI install tree (`composio` binary + assets).
    /// Never use `~/.composio` (the user's personal CLI).
    pub fn composio_cli_dir() -> PathBuf {
        Self::root().join("composio-cli")
    }

    /// Jarbas-only Composio CLI state (user_data, cache). Isolated from `~/.composio`.
    pub fn composio_home() -> PathBuf {
        Self::root().join("composio")
    }

    /// Composio Universal CLI binary symlink / install location for Ask.
    pub fn bin_dir() -> PathBuf {
        Self::root().join("bin")
    }

    pub fn composio_cli() -> PathBuf {
        Self::bin_dir().join(Self::executable_name("composio"))
    }

    /// Real binary inside the app-owned install tree (not a personal symlink).
    #[cfg_attr(windows, allow(dead_code))]
    pub fn composio_cli_binary() -> PathBuf {
        Self::composio_cli_dir().join(Self::executable_name("composio"))
    }

    /// Provider/model preference + API keys for Ask / Pi.
    pub fn llm_settings() -> PathBuf {
        Self::root().join("llm.json")
    }

    /// Last sensitive-text redaction pass summary.
    pub fn redaction_status() -> PathBuf {
        Self::root().join("redaction.json")
    }

    /// Screenpipe paired accessibility SQLite (`db.sqlite`) + snapshot `data/`.
    pub fn capture_dir() -> PathBuf {
        Self::root()
    }

    /// Screenpipe MP4 session files.
    pub fn videos_dir() -> PathBuf {
        Self::root().join("videos")
    }

    /// AI-generated learnings (one JSON file per learning).
    pub fn learnings_dir() -> PathBuf {
        Self::root().join("learnings")
    }

    /// AI-generated opportunities (one JSON file per opportunity).
    pub fn opportunities_dir() -> PathBuf {
        Self::root().join("opportunities")
    }

    /// AI-generated work reports (one JSON file per report).
    pub fn reports_dir() -> PathBuf {
        Self::root().join("reports")
    }

    /// Staging file for an in-flight analysis job.
    pub fn analysis_job_file(job_id: &str) -> PathBuf {
        Self::root().join(format!(".analysis-job-{job_id}.json"))
    }

    /// Saved analysis chat transcripts (shared across items from one run).
    pub fn analysis_runs_dir() -> PathBuf {
        Self::root().join("analysis-runs")
    }

    pub fn ensure_directories() -> Result<(), String> {
        for dir in [
            Self::root(),
            Self::pi_agent(),
            Self::pi_config(),
            Self::pi_sessions(),
            Self::npm_cache(),
            Self::skills_dir(),
            Self::jarbas_skill_dir(),
            Self::composio_skill_dir(),
            Self::bin_dir(),
            Self::composio_cli_dir(),
            Self::composio_home(),
            Self::capture_dir(),
            Self::videos_dir(),
            Self::learnings_dir(),
            Self::opportunities_dir(),
            Self::reports_dir(),
            Self::analysis_runs_dir(),
        ] {
            std::fs::create_dir_all(&dir)
                .map_err(|error| format!("Could not create {}: {error}", dir.display()))?;
        }
        Ok(())
    }
}

/// Join PATH entries with the platform separator (`;` on Windows, `:` elsewhere).
pub fn join_path_env<I, S>(parts: I) -> OsString
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    std::env::join_paths(parts).unwrap_or_default()
}

/// Build a child-process PATH that prefers app bins, then the existing PATH.
pub fn child_path_env(prefer: &[PathBuf]) -> OsString {
    let mut parts: Vec<OsString> = prefer
        .iter()
        .filter(|p| !p.as_os_str().is_empty())
        .map(|p| p.as_os_str().to_os_string())
        .collect();

    if let Some(existing) = std::env::var_os("PATH") {
        for part in std::env::split_paths(&existing) {
            if !part.as_os_str().is_empty()
                && !parts.iter().any(|p| Path::new(p) == part.as_path())
            {
                parts.push(part.into_os_string());
            }
        }
    }

    #[cfg(unix)]
    {
        for extra in ["/usr/bin", "/bin"] {
            let extra_path = PathBuf::from(extra);
            if !parts.iter().any(|p| Path::new(p) == extra_path.as_path()) {
                parts.push(extra_path.into_os_string());
            }
        }
    }

    join_path_env(parts)
}

/// Reject path traversal in analysis item ids (cross-platform).
pub fn is_safe_item_id(id: &str) -> bool {
    let id = id.trim();
    !id.is_empty()
        && !id.contains('/')
        && !id.contains('\\')
        && !id.contains("..")
        && Path::new(id).file_name().and_then(|n| n.to_str()) == Some(id)
}
