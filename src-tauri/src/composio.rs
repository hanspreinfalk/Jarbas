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

const READ_ONLY_AUTH_CONFIG_NAME: &str = "Jarbas read-only";
const READ_ONLY_TOOL_TAG: &str = "readOnlyHint";

fn scope_score(scope: &str) -> i32 {
    let lower = scope.to_ascii_lowercase();
    let mut score = 0i32;

    if lower.contains("readonly") || lower.contains("read_only") {
        score += 120;
    }
    if lower == "read"
        || lower.starts_with("read:")
        || lower.starts_with("read_")
        || lower.ends_with(":read")
        || lower.ends_with(".read")
        || lower.contains(":read.")
        || lower.contains(".read.")
    {
        score += 100;
    }
    if lower.contains(":history") || lower.ends_with(".history") {
        score += 90;
    }
    if lower.contains("freebusy") {
        score += 70;
    }
    if lower.contains("read") {
        score += 30;
    }

    if lower.contains("write")
        || lower.contains("modify")
        || lower.contains("compose")
        || lower.contains("delete")
        || lower.contains("insert")
        || lower.contains("create")
        || lower.contains("manage")
        || lower.contains("admin")
        || matches!(
            lower.as_str(),
            "repo"
                | "gist"
                | "workflow"
                | "user"
                | "project"
                | "codespace"
                | "notifications"
                | "public_repo"
                | "security_events"
                | "repo_deployment"
                | "insert_content"
        )
    {
        score -= 150;
    }

    if matches!(
        lower.as_str(),
        "https://mail.google.com/"
            | "https://www.googleapis.com/auth/calendar"
            | "https://www.googleapis.com/auth/contacts"
            | "https://www.googleapis.com/auth/gmail.labels"
            | "https://www.googleapis.com/auth/gmail.settings.basic"
            | "https://www.googleapis.com/auth/gmail.settings.sharing"
    ) {
        score -= 150;
    }

    score
}

fn pick_read_scope(scopes: &[String]) -> Option<String> {
    scopes
        .iter()
        .map(|scope| (scope, scope_score(scope)))
        .max_by_key(|(_, score)| *score)
        .filter(|(_, score)| *score > 0)
        .map(|(scope, _)| scope.clone())
}

fn collect_read_scopes(per_tool: &[Value], tools_by_slug: &std::collections::HashMap<String, Value>) -> Vec<String> {
    let mut chosen = std::collections::BTreeSet::new();

    for entry in per_tool {
        let tool_slug = entry
            .get("tool")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let Some(requirements) = entry.get("scope_requirements") else {
            if let Some(tool) = tools_by_slug.get(tool_slug) {
                if let Some(scopes) = tool.get("scopes").and_then(Value::as_array) {
                    for scope in scopes.iter().filter_map(Value::as_str) {
                        if scope_score(scope) > 0 {
                            chosen.insert(scope.to_string());
                        }
                    }
                }
            }
            continue;
        };

        if requirements.is_null() {
            if let Some(tool) = tools_by_slug.get(tool_slug) {
                if let Some(scopes) = tool.get("scopes").and_then(Value::as_array) {
                    for scope in scopes.iter().filter_map(Value::as_str) {
                        if scope_score(scope) > 0 {
                            chosen.insert(scope.to_string());
                        }
                    }
                }
            }
            continue;
        }

        if let Some(all_of) = requirements.get("all_of").and_then(Value::as_array) {
            for group in all_of {
                if let Some(any_of) = group.get("any_of").and_then(Value::as_array) {
                    let options: Vec<String> = any_of
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect();
                    if let Some(pick) = pick_read_scope(&options) {
                        chosen.insert(pick);
                    }
                } else if let Some(scope) = group.as_str() {
                    if scope_score(scope) > 0 {
                        chosen.insert(scope.to_string());
                    }
                }
            }
        }
    }

    chosen.into_iter().collect()
}

async fn composio_json(
    client: &Client,
    method: reqwest::Method,
    url: &str,
    api_key: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let mut request = client
        .request(method, url)
        .header("x-api-key", api_key);
    if let Some(body) = body {
        request = request.json(&body);
    }
    let response = request.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    let text = response.text().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!("Composio API error ({status}): {text}"));
    }
    if text.trim().is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&text).map_err(|error| error.to_string())
}

async fn list_toolkit_tools(
    client: &Client,
    api_key: &str,
    toolkit_slug: &str,
) -> Result<Vec<Value>, String> {
    let mut items = Vec::new();
    let mut cursor: Option<String> = None;

    loop {
        let mut request = client
            .get("https://backend.composio.dev/api/v3.1/tools")
            .header("x-api-key", api_key)
            .query(&[("toolkit_slug", toolkit_slug), ("limit", "100")]);
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
        if let Some(page) = payload.get("items").and_then(Value::as_array) {
            items.extend(page.iter().cloned());
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

    Ok(items)
}

async fn list_readonly_tool_slugs(
    client: &Client,
    api_key: &str,
    toolkit_slug: &str,
) -> Result<(Vec<String>, std::collections::HashMap<String, Value>), String> {
    let tools = list_toolkit_tools(client, api_key, toolkit_slug).await?;
    let mut by_slug = std::collections::HashMap::new();
    let mut read_slugs = Vec::new();

    for tool in tools {
        let Some(slug) = tool.get("slug").and_then(Value::as_str).map(str::to_string) else {
            continue;
        };
        let is_read = tool
            .get("tags")
            .and_then(Value::as_array)
            .map(|tags| {
                tags.iter()
                    .filter_map(Value::as_str)
                    .any(|tag| tag == READ_ONLY_TOOL_TAG)
            })
            .unwrap_or(false);
        if is_read {
            read_slugs.push(slug.clone());
        }
        by_slug.insert(slug, tool);
    }

    Ok((read_slugs, by_slug))
}

async fn compute_readonly_scopes(
    client: &Client,
    api_key: &str,
    tool_slugs: &[String],
    tools_by_slug: &std::collections::HashMap<String, Value>,
) -> Result<Vec<String>, String> {
    if tool_slugs.is_empty() {
        return Ok(Vec::new());
    }

    let mut per_tool = Vec::new();
    for chunk in tool_slugs.chunks(80) {
        let payload = composio_json(
            client,
            reqwest::Method::POST,
            "https://backend.composio.dev/api/v3.1/tools/scopes/required",
            api_key,
            Some(json!({ "tools": chunk })),
        )
        .await?;
        if let Some(items) = payload
            .get("per_tool_requirements")
            .and_then(Value::as_array)
        {
            per_tool.extend(items.iter().cloned());
        }
    }

    Ok(collect_read_scopes(&per_tool, tools_by_slug))
}

async fn list_auth_configs_for_toolkit(
    client: &Client,
    api_key: &str,
    toolkit_slug: &str,
) -> Result<Vec<Value>, String> {
    let payload = composio_json(
        client,
        reqwest::Method::GET,
        &format!(
            "https://backend.composio.dev/api/v3.1/auth_configs?toolkit_slug={toolkit_slug}&limit=50"
        ),
        api_key,
        None,
    )
    .await?;

    Ok(payload
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

async fn ensure_readonly_auth_config(
    client: &Client,
    api_key: &str,
    toolkit_slug: &str,
) -> Result<String, String> {
    let (read_slugs, tools_by_slug) =
        list_readonly_tool_slugs(client, api_key, toolkit_slug).await?;
    let scopes = compute_readonly_scopes(client, api_key, &read_slugs, &tools_by_slug).await?;

    let existing = list_auth_configs_for_toolkit(client, api_key, toolkit_slug).await?;
    let readonly_existing = existing.iter().find(|item| {
        item.get("name")
            .and_then(Value::as_str)
            .map(|name| name.eq_ignore_ascii_case(READ_ONLY_AUTH_CONFIG_NAME))
            .unwrap_or(false)
    });

    let auth_config_id = if let Some(item) = readonly_existing {
        item.get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Composio auth config missing id".to_string())?
            .to_string()
    } else {
        let created = composio_json(
            client,
            reqwest::Method::POST,
            "https://backend.composio.dev/api/v3.1/auth_configs",
            api_key,
            Some(json!({
                "toolkit": { "slug": toolkit_slug },
                "auth_config": {
                    "type": "use_composio_managed_auth",
                    "name": READ_ONLY_AUTH_CONFIG_NAME,
                }
            })),
        )
        .await?;

        created
            .pointer("/auth_config/id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Composio create auth config missing id".to_string())?
            .to_string()
    };

    let mut patch = json!({
        "type": "default",
        "name": READ_ONLY_AUTH_CONFIG_NAME,
        "tool_access_config": {
            "tools_available_for_execution": read_slugs,
        }
    });

    if !scopes.is_empty() {
        patch["scopes"] = Value::Array(scopes.into_iter().map(Value::String).collect());
    }

    composio_json(
        client,
        reqwest::Method::PATCH,
        &format!("https://backend.composio.dev/api/v3.1/auth_configs/{auth_config_id}"),
        api_key,
        Some(patch),
    )
    .await?;

    Ok(auth_config_id)
}

#[tauri::command]
pub async fn create_composio_connect_link(
    user_id: String,
    toolkit_slug: String,
) -> Result<ConnectLinkResponse, String> {
    let api_key = composio_api_key()?;
    let client = Client::new();
    let auth_config_id =
        ensure_readonly_auth_config(&client, &api_key, &toolkit_slug).await?;

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
/// Sessions are limited to read-only tools (`readOnlyHint`).
pub async fn create_tool_router_session(user_id: &str) -> Result<ToolRouterSession, String> {
    let trimmed = user_id.trim();
    if trimmed.is_empty() {
        return Err("Missing Composio user id.".into());
    }

    let api_key = composio_api_key()?;
    let client = Client::new();

    // Prefer Jarbas read-only auth configs when the session prompts a connect.
    let mut auth_configs = serde_json::Map::new();
    let mut cursor: Option<String> = None;
    loop {
        let mut request = client
            .get("https://backend.composio.dev/api/v3.1/auth_configs")
            .header("x-api-key", &api_key)
            .query(&[("limit", "100")]);
        if let Some(cursor) = cursor.as_ref() {
            request = request.query(&[("cursor", cursor.as_str())]);
        }
        let response = request.send().await.map_err(|error| error.to_string())?;
        let status = response.status();
        let body = response.text().await.map_err(|error| error.to_string())?;
        if status.is_success() {
            if let Ok(payload) = serde_json::from_str::<Value>(&body) {
                if let Some(items) = payload.get("items").and_then(Value::as_array) {
                    for item in items {
                        let is_readonly = item
                            .get("name")
                            .and_then(Value::as_str)
                            .map(|name| name.eq_ignore_ascii_case(READ_ONLY_AUTH_CONFIG_NAME))
                            .unwrap_or(false);
                        if !is_readonly {
                            continue;
                        }
                        let Some(toolkit) = item
                            .pointer("/toolkit/slug")
                            .and_then(Value::as_str)
                        else {
                            continue;
                        };
                        let Some(id) = item.get("id").and_then(Value::as_str) else {
                            continue;
                        };
                        auth_configs.insert(toolkit.to_string(), Value::String(id.to_string()));
                    }
                }
                cursor = payload
                    .get("next_cursor")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .filter(|value| !value.is_empty());
            } else {
                cursor = None;
            }
        } else {
            cursor = None;
        }
        if cursor.is_none() {
            break;
        }
    }

    let mut session_body = json!({
        "user_id": trimmed,
        "tags": [READ_ONLY_TOOL_TAG],
        "manage_connections": {
            "enable": true,
            "enable_wait_for_connections": false,
            "enable_connection_removal": true
        }
    });
    if !auth_configs.is_empty() {
        session_body["auth_configs"] = Value::Object(auth_configs);
    }

    let response = client
        .post("https://backend.composio.dev/api/v3.1/tool_router/session")
        .header("x-api-key", api_key)
        .json(&session_body)
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
