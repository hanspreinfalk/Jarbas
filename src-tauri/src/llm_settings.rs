use crate::paths::JarbasPaths;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LlmProvider {
    Anthropic,
    Openai,
    Google,
}

impl LlmProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Anthropic => "anthropic",
            Self::Openai => "openai",
            Self::Google => "google",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Anthropic => "Anthropic",
            Self::Openai => "OpenAI",
            Self::Google => "Gemini",
        }
    }

    pub fn env_key(self) -> &'static str {
        match self {
            Self::Anthropic => "ANTHROPIC_API_KEY",
            Self::Openai => "OPENAI_API_KEY",
            Self::Google => "GEMINI_API_KEY",
        }
    }

    pub fn default_model(self) -> &'static str {
        match self {
            Self::Anthropic => "claude-sonnet-4-5",
            Self::Openai => "gpt-4.1",
            Self::Google => "gemini-2.5-pro",
        }
    }

    pub fn models(self) -> &'static [&'static str] {
        match self {
            Self::Anthropic => &[
                "claude-opus-5",
                "claude-sonnet-5",
                "claude-opus-4-8",
                "claude-opus-4-7",
                "claude-sonnet-4-6",
                "claude-opus-4-6",
                "claude-opus-4-5",
                "claude-sonnet-4-5",
                "claude-haiku-4-5",
            ],
            Self::Openai => &[
                "gpt-4.1",
                "gpt-4.1-mini",
                "gpt-4.1-nano",
                "gpt-4o",
                "gpt-4o-mini",
                "o3",
                "o3-mini",
                "o4-mini",
            ],
            Self::Google => &[
                "gemini-3.5-flash",
                "gemini-3.5-flash-lite",
                "gemini-3.1-flash-lite",
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite",
                "gemini-2.5-flash-image",
                "gemini-2.0-flash",
                "gemini-2.0-flash-lite",
                "gemini-1.5-pro",
                "gemini-1.5-flash",
            ],
        }
    }

    pub fn all() -> [Self; 3] {
        [Self::Anthropic, Self::Openai, Self::Google]
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "anthropic" => Some(Self::Anthropic),
            "openai" => Some(Self::Openai),
            "google" | "gemini" => Some(Self::Google),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredLlmSettings {
    provider: String,
    model: String,
    #[serde(default)]
    keys: BTreeMap<String, String>,
}

impl Default for StoredLlmSettings {
    fn default() -> Self {
        Self {
            provider: LlmProvider::Anthropic.as_str().into(),
            model: LlmProvider::Anthropic.default_model().into(),
            keys: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyStatus {
    pub provider: LlmProvider,
    pub label: String,
    pub configured: bool,
    /// Full key for local Settings (view / copy). Empty when unset.
    pub value: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCatalog {
    pub id: LlmProvider,
    pub label: String,
    pub default_model: String,
    pub models: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmSettingsView {
    pub provider: LlmProvider,
    pub model: String,
    pub keys: Vec<KeyStatus>,
    pub providers: Vec<ProviderCatalog>,
}

fn load_stored() -> Result<StoredLlmSettings, String> {
    let path = JarbasPaths::llm_settings();
    if !path.is_file() {
        return Ok(StoredLlmSettings::default());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    serde_json::from_str(&raw)
        .map_err(|error| format!("Could not parse {}: {error}", path.display()))
}

fn save_stored(settings: &StoredLlmSettings) -> Result<(), String> {
    JarbasPaths::ensure_directories()?;
    let path = JarbasPaths::llm_settings();
    let body = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Could not encode llm settings: {error}"))?;
    fs::write(&path, body + "\n")
        .map_err(|error| format!("Could not write {}: {error}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn resolved_provider(stored: &StoredLlmSettings) -> LlmProvider {
    LlmProvider::parse(&stored.provider).unwrap_or(LlmProvider::Anthropic)
}

fn resolved_model(stored: &StoredLlmSettings, provider: LlmProvider) -> String {
    let model = stored.model.trim();
    if provider.models().contains(&model) {
        return model.to_string();
    }
    provider.default_model().to_string()
}

fn catalog() -> Vec<ProviderCatalog> {
    LlmProvider::all()
        .into_iter()
        .map(|provider| ProviderCatalog {
            id: provider,
            label: provider.label().into(),
            default_model: provider.default_model().into(),
            models: provider.models().iter().map(|model| (*model).to_string()).collect(),
        })
        .collect()
}

fn to_view(stored: &StoredLlmSettings) -> LlmSettingsView {
    let provider = resolved_provider(stored);
    let model = resolved_model(stored, provider);
    let keys = LlmProvider::all()
        .into_iter()
        .map(|item| {
            let value = stored
                .keys
                .get(item.as_str())
                .map(|key| key.trim().to_string())
                .filter(|key| !key.is_empty())
                .unwrap_or_default();
            KeyStatus {
                provider: item,
                label: item.label().into(),
                configured: !value.is_empty(),
                value,
            }
        })
        .collect();

    LlmSettingsView {
        provider,
        model,
        keys,
        providers: catalog(),
    }
}

/// Provider, model, and process env vars (API keys) for spawning Pi.
pub fn load_runtime_llm() -> Result<(LlmProvider, String, BTreeMap<String, String>), String> {
    let stored = load_stored()?;
    let provider = resolved_provider(&stored);
    let model = resolved_model(&stored, provider);
    let mut env = BTreeMap::new();
    for item in LlmProvider::all() {
        let Some(key) = stored
            .keys
            .get(item.as_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        // Use only the primary env name per provider (Pi warns if both
        // GEMINI_API_KEY and GOOGLE_API_KEY are set).
        env.insert(item.env_key().to_string(), key);
    }
    if !env.contains_key(provider.env_key()) {
        return Err(format!(
            "Add a {} API key in Settings first.",
            provider.label()
        ));
    }
    Ok((provider, model, env))
}

#[tauri::command]
pub fn get_llm_settings() -> Result<LlmSettingsView, String> {
    Ok(to_view(&load_stored()?))
}

#[tauri::command]
pub fn set_llm_api_key(provider: String, key: String) -> Result<LlmSettingsView, String> {
    let provider = LlmProvider::parse(&provider)
        .ok_or_else(|| format!("Unknown provider: {provider}"))?;
    let trimmed = key.trim().to_string();
    let mut stored = load_stored()?;
    if trimmed.is_empty() {
        stored.keys.remove(provider.as_str());
    } else {
        stored.keys.insert(provider.as_str().into(), trimmed);
    }
    save_stored(&stored)?;
    Ok(to_view(&stored))
}

#[tauri::command]
pub fn clear_llm_api_key(provider: String) -> Result<LlmSettingsView, String> {
    set_llm_api_key(provider, String::new())
}

#[tauri::command]
pub fn set_llm_model(provider: String, model: String) -> Result<LlmSettingsView, String> {
    let provider = LlmProvider::parse(&provider)
        .ok_or_else(|| format!("Unknown provider: {provider}"))?;
    let model = model.trim().to_string();
    if model.is_empty() {
        return Err("Model is required.".into());
    }
    if !provider.models().contains(&model.as_str()) {
        return Err(format!("Unknown model for {}: {model}", provider.label()));
    }
    let mut stored = load_stored()?;
    stored.provider = provider.as_str().into();
    stored.model = model;
    save_stored(&stored)?;
    Ok(to_view(&stored))
}
