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

    /// Provider/model preference + API keys for Ask / Pi.
    pub fn llm_settings() -> PathBuf {
        Self::root().join("llm.json")
    }

    /// Screenpipe MP4 output + paired accessibility SQLite (`db.sqlite`, `data/`).
    pub fn capture_dir() -> PathBuf {
        Self::root()
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
            Self::capture_dir(),
        ] {
            std::fs::create_dir_all(&dir)
                .map_err(|error| format!("Could not create {}: {error}", dir.display()))?;
        }
        Ok(())
    }
}
