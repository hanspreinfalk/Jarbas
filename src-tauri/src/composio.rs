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

async fn resolve_auth_config_id(client: &Client, api_key: &str, toolkit_slug: &str) -> Result<String, String> {
    let response = client
        .get("https://backend.composio.dev/api/v3/auth_configs")
        .header("x-api-key", api_key)
        .query(&[
            ("toolkit_slug", toolkit_slug),
            ("limit", "10"),
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

    let enabled = items.iter().find(|item| {
        item.get("status")
            .and_then(Value::as_str)
            .map(|status| status.eq_ignore_ascii_case("ENABLED"))
            .unwrap_or(true)
    });

    enabled
        .or_else(|| items.first())
        .and_then(|item| item.get("id").and_then(Value::as_str))
        .map(str::to_string)
        .ok_or_else(|| {
            format!("No auth config found for toolkit '{toolkit_slug}'. Enable it in Composio first.")
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
