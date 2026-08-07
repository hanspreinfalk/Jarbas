use std::path::PathBuf;

/// On-disk layout under `~/.jarbas` for this Tauri app (not `.jarbas-main`).
pub struct JarbasPaths;

impl JarbasPaths {
    pub fn root() -> PathBuf {
        let home = std::env::var_os("HOME").unwrap_or_else(|| "/tmp".into());
        PathBuf::from(home).join(".jarbas")
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
        Self::bin_dir().join("composio")
    }

    /// Real binary inside the app-owned install tree (not a personal symlink).
    pub fn composio_cli_binary() -> PathBuf {
        Self::composio_cli_dir().join("composio")
    }

    /// Provider/model preference + API keys for Ask / Pi.
    pub fn llm_settings() -> PathBuf {
        Self::root().join("llm.json")
    }

    /// Screenpipe paired accessibility SQLite (`db.sqlite`) + snapshot `data/`.
    pub fn capture_dir() -> PathBuf {
        Self::root()
    }

    /// Screenpipe MP4 session files.
    pub fn videos_dir() -> PathBuf {
        Self::root().join("videos")
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
        ] {
            std::fs::create_dir_all(&dir)
                .map_err(|error| format!("Could not create {}: {error}", dir.display()))?;
        }
        Ok(())
    }
}
