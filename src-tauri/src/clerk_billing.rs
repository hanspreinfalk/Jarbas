use crate::load_env;
use reqwest::Client;
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOrgSeatLimitResponse {
    pub organization_id: String,
    pub plan_slug: String,
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

fn plan_rank(plan_slug: &str) -> u8 {
    match plan_slug {
        "enterprise" => 3,
        "business" => 2,
        _ => 1,
    }
}

fn best_plan_from_items(items: &[Value]) -> Option<(u8, String)> {
    let mut best: Option<(u8, String)> = None;
    for item in items {
        let status = item
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("");
        if !(status == "active"
            || status == "trialing"
            || status == "free_trial"
            || status.is_empty())
        {
            continue;
        }
        if item.get("ended_at").and_then(Value::as_u64).is_some() {
            continue;
        }
        let slug = item
            .pointer("/plan/slug")
            .or_else(|| item.pointer("/plan/name"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_ascii_lowercase();
        let slug = slug
            .replace(' ', "_")
            .trim()
            .to_string();
        if slug.is_empty() {
            continue;
        }
        // Normalize common Clerk plan slug variants.
        let normalized = if slug.contains("enterprise") {
            "enterprise".to_string()
        } else if slug.contains("business") {
            "business".to_string()
        } else {
            slug
        };
        let rank = plan_rank(&normalized);
        match &best {
            Some((best_rank, _)) if *best_rank >= rank => {}
            _ => best = Some((rank, normalized)),
        }
    }
    best
}

/// Highest active paid plan for this org from Clerk Billing, if any.
async fn active_billing_plan_slug(
    client: &Client,
    secret: &str,
    organization_id: &str,
) -> Result<Option<String>, String> {
    // Prefer the org-scoped subscription endpoint (avoids scanning the whole instance).
    let org_url = format!(
        "https://api.clerk.com/v1/organizations/{organization_id}/billing/subscription"
    );
    let response = client
        .get(&org_url)
        .bearer_auth(secret)
        .send()
        .await
        .map_err(|error| format!("Could not load org billing subscription: {error}"))?;
    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;

    if status.as_u16() == 404 {
        return Ok(None);
    }
    if !status.is_success() {
        return Err(format!(
            "Could not load org billing subscription ({status}): {body}"
        ));
    }

    let payload: Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;
    let subscription_status = payload
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_ascii_lowercase();
    if matches!(
        subscription_status.as_str(),
        "canceled" | "cancelled" | "ended" | "expired" | "incomplete_expired"
    ) {
        // Explicitly cancelled / ended subscription — confirmed free.
        return Ok(Some("free_org".to_string()));
    }

    let items = payload
        .get("subscription_items")
        .or_else(|| payload.get("items"))
        .or_else(|| payload.get("data"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    if let Some((_, slug)) = best_plan_from_items(&items) {
        return Ok(Some(slug));
    }

    // Subscription exists but we could not identify a paid plan. Treat as
    // unknown (None) unless status already said canceled above — so checkout
    // anti-clawback still protects elevated seats when items are briefly empty.
    Ok(None)
}

fn resolve_plan_slug(billing_slug: Option<String>, client_hint: &str, force: bool) -> String {
    let hint = client_hint.trim();
    let _ = force;
    match billing_slug {
        Some(slug) if plan_rank(&slug) >= 2 => slug,
        Some(slug) => {
            // Prefer an explicit paid client claim (has() / checkout) over a
            // lingering free billing row. Free client claims keep billing free
            // so cancellations can downgrade seats.
            if plan_rank(hint) >= 2 {
                hint.to_string()
            } else if slug.is_empty() {
                "free_org".to_string()
            } else {
                slug
            }
        }
        None => {
            if plan_rank(hint) >= 2 {
                hint.to_string()
            } else if hint.is_empty() {
                "free_org".to_string()
            } else {
                hint.to_string()
            }
        }
    }
}

/// Sets the Organization membership cap to match the active Clerk Billing plan.
#[tauri::command]
pub async fn sync_org_seat_limit(
    organization_id: String,
    plan_slug: String,
    force: Option<bool>,
) -> Result<SyncOrgSeatLimitResponse, String> {
    let organization_id = organization_id.trim().to_string();
    let plan_hint = plan_slug.trim().to_string();
    let force = force.unwrap_or(false);
    if organization_id.is_empty() {
        return Err("organization_id is required".into());
    }

    let secret = clerk_secret_key()?;
    let client = Client::new();

    let billing_slug =
        active_billing_plan_slug(&client, &secret, &organization_id).await?;
    let billing_confirmed = billing_slug.is_some();
    let resolved_plan = resolve_plan_slug(billing_slug, &plan_hint, force);
    let target = seat_limit_for_plan(&resolved_plan);
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

    let current_json: Value = current
        .json()
        .await
        .map_err(|error| format!("Invalid organization response: {error}"))?;
    let current_limit = current_json
        .get("max_allowed_memberships")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    // Checkout race: seats already elevated and Clerk has not returned any
    // subscription payload yet (404 / unknown). Do not claw seats back on a
    // free hint. Confirmed free (`Some("free_org")` from an ended/empty
    // subscription) still downgrades.
    if target < current_limit
        && plan_rank(&resolved_plan) <= 1
        && !billing_confirmed
        && matches!(current_limit, 10 | 20)
    {
        return Ok(SyncOrgSeatLimitResponse {
            organization_id,
            plan_slug: resolved_plan,
            max_allowed_memberships: current_limit,
            updated: false,
        });
    }

    if current_limit == target {
        return Ok(SyncOrgSeatLimitResponse {
            organization_id,
            plan_slug: resolved_plan,
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
        plan_slug: resolved_plan,
        max_allowed_memberships: target,
        updated: true,
    })
}
