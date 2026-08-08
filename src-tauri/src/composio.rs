use crate::composio_api_key;
use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectedAccountItem {
    pub id: String,
    pub toolkit_slug: String,
    pub status: String,
    pub alias: Option<String>,
    pub word_id: Option<String>,
    pub label: String,
    pub detail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectedAccountsResponse {
    pub items: Vec<ConnectedAccountItem>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectLinkResponse {
    pub redirect_url: String,
    pub connected_account_id: String,
    pub expires_at: Option<String>,
}

fn account_label(item: &Value) -> String {
    if let Some(alias) = item.get("alias").and_then(Value::as_str).filter(|s| !s.is_empty()) {
        return alias.to_string();
    }
    if let Some(word_id) = item.get("word_id").and_then(Value::as_str).filter(|s| !s.is_empty()) {
        return word_id.to_string();
    }
    item.get("id")
        .and_then(Value::as_str)
        .unwrap_or("Connected account")
        .to_string()
}

fn account_detail(item: &Value) -> String {
    let status = item
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("UNKNOWN");
    match status {
        "ACTIVE" => "Connected".to_string(),
        "INITIALIZING" | "INITIATED" => "Waiting for authorization".to_string(),
        other => other.to_string(),
    }
}

#[tauri::command]
pub async fn list_composio_connected_accounts(
    user_id: String,
) -> Result<ConnectedAccountsResponse, String> {
    let api_key = composio_api_key()?;
    let client = Client::new();

    let mut items: Vec<ConnectedAccountItem> = Vec::new();
    let mut cursor: Option<String> = None;

    loop {
        let mut request = client
            .get("https://backend.composio.dev/api/v3/connected_accounts")
            .header("x-api-key", &api_key)
            .query(&[
                ("user_ids", user_id.as_str()),
                ("limit", "100"),
            ]);

        if let Some(cursor) = cursor.as_ref() {
            request = request.query(&[("cursor", cursor.as_str())]);
        }

        let response = request.send().await.map_err(|error| error.to_string())?;
        let status = response.status();
        let body = response.text().await.map_err(|error| error.to_string())?;
        if !status.is_success() {
            return Err(format!("Composio API error ({status}): {body}"));
        }

        let payload: Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;
        let page_items = payload
            .get("items")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        for item in page_items {
            let account_status = item
                .get("status")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            if account_status == "EXPIRED" || account_status == "FAILED" {
                continue;
            }
            let toolkit_slug = item
                .pointer("/toolkit/slug")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let id = item
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            if id.is_empty() || toolkit_slug.is_empty() {
                continue;
            }

            items.push(ConnectedAccountItem {
                id,
                toolkit_slug,
                status: account_status,
                alias: item
                    .get("alias")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                word_id: item
                    .get("word_id")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                label: account_label(&item),
                detail: account_detail(&item),
            });
        }

        cursor = payload
            .get("next_cursor")
            .and_then(Value::as_str)
            .map(str::to_string)
            .filter(|value| !value.is_empty());
        if cursor.is_none() {
            break;
        }
    }

    Ok(ConnectedAccountsResponse { items })
}

/// Active connected toolkit slugs for a user.
/// Returns `Ok(None)` when there is no user id. `Err` on API failure (do not
/// treat as "no connectors" for policy decisions).
pub fn active_connected_toolkit_slugs(
    user_id: Option<&str>,
) -> Result<Option<Vec<String>>, String> {
    let Some(user_id) = user_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let response = tauri::async_runtime::block_on(list_composio_connected_accounts(
        user_id.to_string(),
    ))?;
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
    Ok(Some(slugs))
}

/// Whether the user currently has active connectors.
/// On API errors returns `Err` so callers can keep prior policy instead of
/// flipping to "no connectors".
pub fn user_has_active_connectors(user_id: Option<&str>) -> Result<bool, String> {
    Ok(active_connected_toolkit_slugs(user_id)?
        .map(|slugs| !slugs.is_empty())
        .unwrap_or(false))
}

async fn resolve_auth_config_id(client: &Client, api_key: &str, toolkit_slug: &str) -> Result<String, String> {
    let response = client
        .get("https://backend.composio.dev/api/v3/auth_configs")
        .header("x-api-key", api_key)
        .query(&[
            ("toolkit_slug", toolkit_slug),
            ("limit", "20"),
        ])
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!("Composio API error ({status}): {body}"));
    }

    let payload: Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;
    let items = payload
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    // Prefer a normal managed config — skip leftover "Jarbas read-only" experiments.
    let existing = items
        .iter()
        .find(|item| {
            let name = item.get("name").and_then(Value::as_str).unwrap_or("");
            if name.eq_ignore_ascii_case("Jarbas read-only") {
                return false;
            }
            item.get("status")
                .and_then(Value::as_str)
                .map(|status| status.eq_ignore_ascii_case("ENABLED"))
                .unwrap_or(true)
        })
        .or_else(|| {
            items.iter().find(|item| {
                let name = item.get("name").and_then(Value::as_str).unwrap_or("");
                !name.eq_ignore_ascii_case("Jarbas read-only")
            })
        })
        .and_then(|item| item.get("id").and_then(Value::as_str))
        .map(str::to_string);

    if let Some(id) = existing {
        return Ok(id);
    }

    // First-time toolkit: create a Composio-managed auth config on demand.
    let created = client
        .post("https://backend.composio.dev/api/v3.1/auth_configs")
        .header("x-api-key", api_key)
        .json(&json!({
            "toolkit": { "slug": toolkit_slug },
            "auth_config": {
                "type": "use_composio_managed_auth",
                "name": "Jarbas",
            }
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let created_status = created.status();
    let created_body = created.text().await.map_err(|error| error.to_string())?;
    if !created_status.is_success() {
        return Err(format!(
            "Could not create auth config for '{toolkit_slug}' ({created_status}): {created_body}"
        ));
    }
    let created_payload: Value =
        serde_json::from_str(&created_body).map_err(|error| error.to_string())?;
    created_payload
        .pointer("/auth_config/id")
        .or_else(|| created_payload.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| {
            format!("Composio create auth config missing id for toolkit '{toolkit_slug}'.")
        })
}

#[tauri::command]
pub async fn create_composio_connect_link(
    user_id: String,
    toolkit_slug: String,
) -> Result<ConnectLinkResponse, String> {
    let api_key = composio_api_key()?;
    let client = Client::new();
    let auth_config_id = resolve_auth_config_id(&client, &api_key, &toolkit_slug).await?;

    let response = client
        .post("https://backend.composio.dev/api/v3/connected_accounts/link")
        .header("x-api-key", api_key)
        .json(&json!({
            "user_id": user_id,
            "auth_config_id": auth_config_id,
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!("Composio API error ({status}): {body}"));
    }

    let payload: Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;
    let redirect_url = payload
        .get("redirect_url")
        .and_then(Value::as_str)
        .ok_or_else(|| "Composio connect link missing redirect_url".to_string())?
        .to_string();
    let connected_account_id = payload
        .get("connected_account_id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    Ok(ConnectLinkResponse {
        redirect_url,
        connected_account_id,
        expires_at: payload
            .get("expires_at")
            .and_then(Value::as_str)
            .map(str::to_string),
    })
}

#[tauri::command]
pub async fn delete_composio_connected_account(account_id: String) -> Result<(), String> {
    let api_key = composio_api_key()?;
    let client = Client::new();

    let response = client
        .delete(format!(
            "https://backend.composio.dev/api/v3/connected_accounts/{account_id}"
        ))
        .header("x-api-key", api_key)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Composio API error ({status}): {body}"));
    }

    Ok(())
}

#[derive(Debug, Clone)]
pub struct ToolRouterSession {
    pub session_id: String,
    pub mcp_url: String,
}

/// Create a Tool Router session for the signed-in Jarbas user (project API key + user id).
pub async fn create_tool_router_session(user_id: &str) -> Result<ToolRouterSession, String> {
    let trimmed = user_id.trim();
    if trimmed.is_empty() {
        return Err("Missing Composio user id.".into());
    }

    let api_key = composio_api_key()?;
    let client = Client::new();
    let response = client
        .post("https://backend.composio.dev/api/v3.1/tool_router/session")
        .header("x-api-key", api_key)
        .json(&json!({
            "user_id": trimmed,
            "manage_connections": {
                "enable": true,
                "enable_wait_for_connections": false,
                "enable_connection_removal": true
            }
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!("Composio Tool Router error ({status}): {body}"));
    }

    let payload: Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;
    let session_id = payload
        .get("session_id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Composio Tool Router response missing session_id".to_string())?
        .to_string();
    let mcp_url = payload
        .pointer("/mcp/url")
        .and_then(Value::as_str)
        .ok_or_else(|| "Composio Tool Router response missing mcp.url".to_string())?
        .to_string();

    Ok(ToolRouterSession {
        session_id,
        mcp_url,
    })
}

/// Write Pi `mcp.json` with a Tool Router MCP server scoped to this user.
/// Call immediately before starting the Ask process.
pub fn configure_composio_mcp_for_user(user_id: Option<&str>) -> Result<Option<String>, String> {
    use crate::paths::JarbasPaths;

    JarbasPaths::ensure_directories()?;
    let cache = JarbasPaths::pi_config().join("mcp-cache.json");
    let _ = std::fs::remove_file(&cache);

    let Some(user_id) = user_id.map(str::trim).filter(|value| !value.is_empty()) else {
        write_mcp_config(None, None)?;
        return Ok(None);
    };

    if composio_api_key().is_err() {
        write_mcp_config(None, None)?;
        return Ok(None);
    }

    let session = tauri::async_runtime::block_on(create_tool_router_session(user_id))?;
    write_mcp_config(Some(&session.mcp_url), Some(&session.session_id))?;
    Ok(Some(session.session_id))
}

fn write_mcp_config(mcp_url: Option<&str>, session_id: Option<&str>) -> Result<(), String> {
    use crate::paths::JarbasPaths;

    let mcp = if let Some(url) = mcp_url {
        json!({
            "settings": {
                "directTools": true,
                "toolPrefix": "none",
            },
            "mcpServers": {
                "composio": {
                    "url": url,
                    "headers": {
                        "x-api-key": "${COMPOSIO_API_KEY}"
                    },
                    "lifecycle": "eager",
                    "requestTimeoutMs": 120000
                }
            },
            "note": format!(
                "Composio Tool Router session {}",
                session_id.unwrap_or("unknown")
            ),
        })
    } else {
        json!({
            "settings": {
                "directTools": true,
                "toolPrefix": "none",
            },
            "mcpServers": {},
            "note": "Composio MCP idle — sign in and open Ask to create a Tool Router session.",
        })
    };

    let path = JarbasPaths::mcp_config();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }
    let body = serde_json::to_string_pretty(&mcp)
        .map_err(|error| format!("Could not encode mcp.json: {error}"))?;
    std::fs::write(&path, body + "\n")
        .map_err(|error| format!("Could not write {}: {error}", path.display()))
}
