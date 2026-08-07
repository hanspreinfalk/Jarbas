use crate::load_env;
use reqwest::Client;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOrgSeatLimitResponse {
    pub organization_id: String,
    pub max_allowed_memberships: u32,
    pub updated: bool,
}

fn clerk_secret_key() -> Result<String, String> {
    load_env();
    let key = std::env::var("CLERK_SECRET_KEY")
        .map_err(|_| "CLERK_SECRET_KEY is missing from .env.local".to_string())?;
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err("CLERK_SECRET_KEY is empty".into());
    }
    Ok(trimmed)
}

fn seat_limit_for_plan(plan_slug: &str) -> u32 {
    match plan_slug {
        "business" => 10,
        "enterprise" => 20,
        // free_org and anything unknown stay solo.
        _ => 1,
    }
}

/// Sets the Organization membership cap to match the active Clerk Billing plan.
#[tauri::command]
pub async fn sync_org_seat_limit(
    organization_id: String,
    plan_slug: String,
) -> Result<SyncOrgSeatLimitResponse, String> {
    let organization_id = organization_id.trim().to_string();
    let plan_slug = plan_slug.trim().to_string();
    if organization_id.is_empty() {
        return Err("organization_id is required".into());
    }

    let secret = clerk_secret_key()?;
    let target = seat_limit_for_plan(&plan_slug);
    let client = Client::new();
    let url = format!("https://api.clerk.com/v1/organizations/{organization_id}");

    let current = client
        .get(&url)
        .bearer_auth(&secret)
        .send()
        .await
        .map_err(|error| format!("Could not load organization: {error}"))?;

    if !current.status().is_success() {
        let status = current.status();
        let body = current.text().await.unwrap_or_default();
        return Err(format!("Could not load organization ({status}): {body}"));
    }

    let current_json: serde_json::Value = current
        .json()
        .await
        .map_err(|error| format!("Invalid organization response: {error}"))?;
    let current_limit = current_json
        .get("max_allowed_memberships")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    if current_limit == target {
        return Ok(SyncOrgSeatLimitResponse {
            organization_id,
            max_allowed_memberships: target,
            updated: false,
        });
    }

    let patched = client
        .patch(&url)
        .bearer_auth(&secret)
        .json(&serde_json::json!({ "max_allowed_memberships": target }))
        .send()
        .await
        .map_err(|error| format!("Could not update organization seats: {error}"))?;

    if !patched.status().is_success() {
        let status = patched.status();
        let body = patched.text().await.unwrap_or_default();
        return Err(format!(
            "Could not update organization seats ({status}): {body}"
        ));
    }

    Ok(SyncOrgSeatLimitResponse {
        organization_id,
        max_allowed_memberships: target,
        updated: true,
    })
}
