//! Regex PII scrubbing for local capture text in `~/.jarbas/db.sqlite`.
//! Patterns mirror Screenpipe's basic `use_pii_removal` hot-path list.

use crate::paths::JarbasPaths;
use regex::Regex;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::sync::LazyLock;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

static PASSWORD_CONTEXT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)((?:master\s+)?(?:password|passcode|passphrase|pin|secret\s*key|unlock\s*code|security\s*code)[\s]*[:=][\s]*)(\S+)",
    )
    .expect("password context regex")
});

/// (pattern, replacement tag without brackets)
static PII_RULES: LazyLock<Vec<(Regex, &'static str)>> = LazyLock::new(|| {
    let rules: Vec<(&str, &str)> = vec![
        (r"\b(?:\d{4}[-\s]?){3}\d{4}\b", "CREDIT_CARD"),
        (r"\b\d{3}-\d{2}-\d{4}\b", "SSN"),
        (
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
            "EMAIL",
        ),
        (
            r"\+\d{1,3}[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\(?[2-9]\d{2}\)[-.\s]?\d{3}[-.\s]?\d{4}|[2-9]\d{2}[-.\s]\d{3}[-.\s]\d{4}",
            "PHONE",
        ),
        (
            r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b",
            "IP_ADDRESS",
        ),
        (
            r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",
            "JWT_TOKEN",
        ),
        (r"-----BEGIN[A-Z\s]+PRIVATE KEY-----", "PRIVATE_KEY"),
        (r"-----BEGIN[A-Z\s]+SECRET-----", "PRIVATE_KEY"),
        (
            r"(?i)(?:postgres|postgresql|mysql|mariadb|mongodb|mongodb\+srv|redis|rediss|amqp|amqps)://[^:]+:[^@]+@[^\s]+",
            "CONNECTION_STRING",
        ),
        (
            r"[a-z][a-z0-9+.-]*://[^:]+:[^@]+@[^\s]+",
            "URL_WITH_CREDENTIALS",
        ),
        (
            r"\b(?:sk_live|sk_test|pk_live|pk_test|whsec|rk_live|rk_test)_[A-Za-z0-9]{10,}",
            "STRIPE_KEY",
        ),
        (
            r"\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{20,}",
            "ANTHROPIC_KEY",
        ),
        (r"\bsk-ant-[A-Za-z0-9_-]{20,}", "ANTHROPIC_KEY"),
        (
            r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b",
            "OPENAI_KEY",
        ),
        (r"\bAIza[A-Za-z0-9_-]{35}\b", "GOOGLE_API_KEY"),
        (r"\bhf_[A-Za-z0-9]{34}\b", "HUGGINGFACE_TOKEN"),
        (r"\bgh[pousr]_[A-Za-z0-9]{36,40}\b", "GITHUB_TOKEN"),
        (r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}", "GITHUB_TOKEN"),
        (r"\bv1\.0-[A-Za-z0-9_-]{40,}\b", "CLOUDFLARE_TOKEN"),
        (
            r"\bsb_(?:publishable|secret)_[A-Za-z0-9_-]{5,}",
            "SUPABASE_KEY",
        ),
        (
            r"\b(?:xoxb|xoxp|xoxe|xoxa|xoxs|xapp)-[A-Za-z0-9-]{10,}",
            "SLACK_TOKEN",
        ),
        (
            r"\b[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}",
            "DISCORD_TOKEN",
        ),
        (
            r"\b(?:glpat|glcbt|gloas|glsoat)-[A-Za-z0-9_-]{20,}",
            "GITLAB_TOKEN",
        ),
        (r"\bnpm_[A-Za-z0-9]{36,}", "NPM_TOKEN"),
        (r"\bpypi-[A-Za-z0-9_-]{50,}", "PYPI_TOKEN"),
        (r"\bdop_v1_[A-Za-z0-9]{64}", "DIGITALOCEAN_TOKEN"),
        (r"\b\d{8,10}:[A-Za-z0-9_-]{35}", "TELEGRAM_TOKEN"),
        (r"\bSK[A-Za-z0-9]{32}", "TWILIO_KEY"),
        (r"\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}", "SENDGRID_KEY"),
        (r"\b[A-Fa-f0-9]{32}-us\d{1,2}", "MAILCHIMP_KEY"),
        (r"\bAKIA[0-9A-Z]{16}\b", "AWS_KEY"),
        (
            r"(?i)(?:aws_secret|secret_access_key|aws_secret_access_key)\s*[=:]\s*[A-Za-z0-9/+=]{40}",
            "AWS_SECRET",
        ),
        (
            r"(?i)(?:azure|az)[_-]?(?:storage|account|key|secret|connection)[_-]?(?:key|string)?\s*[=:]\s*[A-Za-z0-9+/=]{40,}",
            "AZURE_KEY",
        ),
        (
            r"\b(?:api|key|token|secret|bearer)[-_][A-Za-z0-9_-]{20,}",
            "API_KEY",
        ),
        (
            r"(?i)\b(?:authorization|bearer)\s*[:\s]\s*[A-Za-z0-9_-]{20,}",
            "AUTH_TOKEN",
        ),
        (
            r"\b[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL)[A-Z0-9_]*\s*=\s*[^\s,;]{8,}",
            "ENV_SECRET",
        ),
        (
            r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b",
            "IBAN",
        ),
        (
            r"(?i)\b(?:seed|recovery|mnemonic|backup)\s*(?:phrase|words?)?\s*[:\s]\s*(?:[a-z]+\s+){11,23}[a-z]+",
            "SEED_PHRASE",
        ),
        (
            r"(?i)(?:backup|recovery|2fa|totp)\s*(?:code|key)s?\s*[:\s]\s*(?:[A-Z0-9]{4,8}[-\s]?){2,}",
            "BACKUP_CODE",
        ),
        (r"[•·●○◦⦁⁃]{4,}|\.{8,}|\*{8,}", "PASSWORD_DOTS"),
        (
            r"(?i)(?:encryption|confirm|enter|your)\s+password\s*[A-Za-z0-9!@#$%^&*]{4,}",
            "PASSWORD_FIELD",
        ),
    ];

    rules
        .into_iter()
        .map(|(pattern, tag)| {
            (
                Regex::new(pattern).unwrap_or_else(|e| panic!("bad PII regex `{pattern}`: {e}")),
                tag,
            )
        })
        .collect()
});

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedactResult {
    /// Stable id for this pass (newest runs first in history).
    #[serde(default)]
    id: String,
    scanned_rows: u64,
    updated_rows: u64,
    message: String,
    /// Inclusive calendar start date (YYYY-MM-DD) for this pass.
    #[serde(default)]
    start_date: String,
    /// Inclusive calendar end date (YYYY-MM-DD) for this pass.
    #[serde(default)]
    end_date: String,
    /// RFC3339 / ISO-8601 UTC timestamp for when this pass started.
    #[serde(default)]
    started_at: String,
    /// RFC3339 / ISO-8601 UTC timestamp for when this pass finished.
    completed_at: String,
    /// Wall-clock duration of the pass in milliseconds.
    #[serde(default)]
    duration_ms: u64,
    /// Total regex matches replaced across all categories.
    #[serde(default)]
    total_matches: u64,
    /// Match counts keyed by category tag (EMAIL, PASSWORD, OPENAI_KEY, …).
    #[serde(default)]
    counts: BTreeMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RedactionHistory {
    /// Newest run first.
    #[serde(default)]
    runs: Vec<RedactResult>,
    /// When true, End Recording auto-redacts the session just captured.
    #[serde(default = "default_true")]
    auto_redact_on_stop: bool,
    /// PII / secret category tags enabled for scrubbing (EMAIL, PASSWORD, …).
    #[serde(default = "default_enabled_categories")]
    enabled_categories: Vec<String>,
}

impl Default for RedactionHistory {
    fn default() -> Self {
        Self {
            runs: Vec::new(),
            auto_redact_on_stop: true,
            enabled_categories: default_enabled_categories(),
        }
    }
}

fn default_true() -> bool {
    true
}

/// High-signal secrets only — safest default (fewest false positives).
/// Keep in sync with `REDACTION_SECRETS_TAGS` in `src/lib/redaction-categories.ts`.
fn default_enabled_categories() -> Vec<String> {
    [
        "PASSWORD",
        "PASSWORD_DOTS",
        "PASSWORD_FIELD",
        "PRIVATE_KEY",
        "CONNECTION_STRING",
        "URL_WITH_CREDENTIALS",
        "JWT_TOKEN",
        "STRIPE_KEY",
        "ANTHROPIC_KEY",
        "OPENAI_KEY",
        "GOOGLE_API_KEY",
        "HUGGINGFACE_TOKEN",
        "GITHUB_TOKEN",
        "CLOUDFLARE_TOKEN",
        "SUPABASE_KEY",
        "SLACK_TOKEN",
        "DISCORD_TOKEN",
        "GITLAB_TOKEN",
        "NPM_TOKEN",
        "PYPI_TOKEN",
        "DIGITALOCEAN_TOKEN",
        "TELEGRAM_TOKEN",
        "TWILIO_KEY",
        "SENDGRID_KEY",
        "MAILCHIMP_KEY",
        "AWS_KEY",
        "AWS_SECRET",
        "AZURE_KEY",
        "SEED_PHRASE",
        "BACKUP_CODE",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

fn all_category_tags() -> Vec<String> {
    let mut tags: Vec<String> = PII_RULES
        .iter()
        .map(|(_, tag)| (*tag).to_string())
        .collect();
    tags.push("PASSWORD".into());
    tags.sort();
    tags.dedup();
    tags
}

const MAX_REDACTION_RUNS: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedactionPrefs {
    auto_redact_on_stop: bool,
    #[serde(default = "default_enabled_categories")]
    enabled_categories: Vec<String>,
}

/// Scrub emails, keys, passwords, cards, and similar patterns from stored capture text.
///
/// `start_date` / `end_date` are inclusive local calendar dates (`YYYY-MM-DD`).
/// When `dry_run` is true, returns the same count shape without writing or recording history.
/// Heavy work runs on a blocking thread so the UI can keep painting a loader.
#[tauri::command]
pub async fn redact_jarbas_capture(
    start_date: String,
    end_date: String,
    dry_run: Option<bool>,
) -> Result<RedactResult, String> {
    let start_date = start_date.trim().to_string();
    let end_date = end_date.trim().to_string();
    validate_ymd_range(&start_date, &end_date)?;
    let dry_run = dry_run.unwrap_or(false);

    tokio::task::spawn_blocking(move || {
        redact_jarbas_capture_blocking(start_date, end_date, dry_run)
    })
    .await
    .map_err(|e| format!("Redaction task failed: {e}"))?
}

fn redact_jarbas_capture_blocking(
    start_date: String,
    end_date: String,
    dry_run: bool,
) -> Result<RedactResult, String> {
    let started_at = now_rfc3339();
    let started = Instant::now();
    let enabled = load_enabled_category_set()?;
    let db_path = JarbasPaths::root().join("db.sqlite");
    if !db_path.is_file() {
        let result = empty_result(
            &start_date,
            &end_date,
            started_at,
            if dry_run {
                "Preview: no local capture database found yet."
            } else {
                "No local capture database found yet."
            },
        );
        if !dry_run {
            append_redaction_run(&result)?;
        }
        return Ok(result);
    }

    let mut conn = Connection::open(&db_path)
        .map_err(|e| format!("Could not open capture database: {e}"))?;
    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| format!("Could not set database busy timeout: {e}"))?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Could not start redaction transaction: {e}"))?;

    let mut scanned = 0u64;
    let mut updated = 0u64;
    let mut counts: BTreeMap<String, u64> = BTreeMap::new();
    let range = TimeRange {
        start: start_date.as_str(),
        end: end_date.as_str(),
    };

    // frames: primary searchable text surfaces
    redact_query(
        &tx,
        "frames",
        "id",
        &["full_text", "accessibility_text"],
        None,
        "id",
        &["full_text", "accessibility_text"],
        &format!("FROM frames WHERE {}", range.where_sql("timestamp")),
        dry_run,
        &enabled,
        &mut scanned,
        &mut updated,
        &mut counts,
    )?;

    // ocr_text keyed by frame_id (no surrogate id in this schema)
    redact_query(
        &tx,
        "ocr_text",
        "frame_id",
        &["text", "text_json"],
        Some("redacted_at"),
        "o.frame_id",
        &["o.text", "o.text_json"],
        &format!(
            "FROM ocr_text o INNER JOIN frames f ON f.id = o.frame_id WHERE {}",
            range.where_sql("f.timestamp")
        ),
        dry_run,
        &enabled,
        &mut scanned,
        &mut updated,
        &mut counts,
    )?;

    redact_query(
        &tx,
        "ui_events",
        "id",
        &[
            "text_content",
            "element_value",
            "element_name",
            "element_description",
        ],
        Some("redacted_at"),
        "id",
        &[
            "text_content",
            "element_value",
            "element_name",
            "element_description",
        ],
        &format!("FROM ui_events WHERE {}", range.where_sql("timestamp")),
        dry_run,
        &enabled,
        &mut scanned,
        &mut updated,
        &mut counts,
    )?;

    redact_query(
        &tx,
        "elements",
        "id",
        &["text", "properties"],
        None,
        "e.id",
        &["e.text", "e.properties"],
        &format!(
            "FROM elements e INNER JOIN frames f ON f.id = e.frame_id WHERE {}",
            range.where_sql("f.timestamp")
        ),
        dry_run,
        &enabled,
        &mut scanned,
        &mut updated,
        &mut counts,
    )?;

    redact_query(
        &tx,
        "audio_transcriptions",
        "id",
        &["transcription"],
        Some("redacted_at"),
        "id",
        &["transcription"],
        &format!(
            "FROM audio_transcriptions WHERE {}",
            range.where_sql("timestamp")
        ),
        dry_run,
        &enabled,
        &mut scanned,
        &mut updated,
        &mut counts,
    )?;

    // Optional memories text if the table exists with a content-like column.
    if table_exists(&tx, "memories")? {
        let content_col = first_existing_column(&tx, "memories", &["content", "text", "body"])?;
        let time_col =
            first_existing_column(&tx, "memories", &["created_at", "updated_at", "timestamp"])?;
        if let (Some(col), Some(time)) = (content_col, time_col) {
            redact_query(
                &tx,
                "memories",
                "id",
                &[col.as_str()],
                None,
                "id",
                &[col.as_str()],
                &format!("FROM memories WHERE {}", range.where_sql(&time)),
                dry_run,
                &enabled,
                &mut scanned,
                &mut updated,
                &mut counts,
            )?;
        }
    }

    if dry_run {
        // Discard any accidental writes; dry-run must not mutate the DB.
        tx.rollback()
            .map_err(|e| format!("Could not roll back dry-run redaction: {e}"))?;
    } else {
        tx.commit()
            .map_err(|e| format!("Could not commit redaction: {e}"))?;
    }

    let total_matches: u64 = counts.values().copied().sum();
    let duration_ms = started.elapsed().as_millis() as u64;
    let completed_at = now_rfc3339();

    let message = if dry_run {
        if updated == 0 {
            format!(
                "Preview: scanned {scanned} text fields from {start_date} → {end_date}. Nothing would be redacted."
            )
        } else {
            format!(
                "Preview: would redact {total_matches} sensitive matches across {updated} of {scanned} fields ({start_date} → {end_date})."
            )
        }
    } else if updated == 0 {
        format!(
            "Scanned {scanned} text fields from {start_date} → {end_date}. Nothing needed redacting."
        )
    } else {
        format!(
            "Redacted {total_matches} sensitive matches across {updated} of {scanned} fields ({start_date} → {end_date})."
        )
    };

    let result = RedactResult {
        id: new_run_id(&completed_at),
        scanned_rows: scanned,
        updated_rows: updated,
        message,
        start_date,
        end_date,
        started_at,
        completed_at,
        duration_ms,
        total_matches,
        counts,
    };
    if !dry_run {
        append_redaction_run(&result)?;
    }
    Ok(result)
}

fn empty_result(
    start_date: &str,
    end_date: &str,
    started_at: String,
    message: &str,
) -> RedactResult {
    RedactResult {
        id: new_run_id(&started_at),
        scanned_rows: 0,
        updated_rows: 0,
        message: message.into(),
        start_date: start_date.into(),
        end_date: end_date.into(),
        started_at: started_at.clone(),
        completed_at: started_at,
        duration_ms: 0,
        total_matches: 0,
        counts: BTreeMap::new(),
    }
}

struct TimeRange<'a> {
    start: &'a str,
    end: &'a str,
}

impl TimeRange<'_> {
    fn where_sql(&self, column: &str) -> String {
        // Inclusive calendar end date, matching analysis queries.
        format!(
            "{column} >= '{}' AND {column} < date('{}', '+1 day')",
            self.start, self.end
        )
    }
}

fn validate_ymd_range(start: &str, end: &str) -> Result<(), String> {
    if !is_ymd(start) || !is_ymd(end) {
        return Err("Dates must be YYYY-MM-DD.".into());
    }
    if start > end {
        return Err("startDate must be on or before endDate.".into());
    }
    Ok(())
}

fn is_ymd(value: &str) -> bool {
    value.len() == 10
        && value.as_bytes().get(4) == Some(&b'-')
        && value.as_bytes().get(7) == Some(&b'-')
        && value[..4].chars().all(|c| c.is_ascii_digit())
        && value[5..7].chars().all(|c| c.is_ascii_digit())
        && value[8..10].chars().all(|c| c.is_ascii_digit())
}

/// Returns the last persisted redaction pass, if any.
#[tauri::command]
pub fn get_last_redaction() -> Result<Option<RedactResult>, String> {
    Ok(load_redaction_history()?.runs.into_iter().next())
}

/// Returns every stored redaction pass, newest first.
#[tauri::command]
pub fn get_redaction_history() -> Result<Vec<RedactResult>, String> {
    Ok(load_redaction_history()?.runs)
}

/// Preferences for automatic redaction after capture.
#[tauri::command]
pub fn get_redaction_prefs() -> Result<RedactionPrefs, String> {
    let history = load_redaction_history()?;
    Ok(prefs_from_history(&history))
}

/// Persist whether End Recording should auto-redact the just-finished session.
#[tauri::command]
pub fn set_auto_redact_on_stop(enabled: bool) -> Result<RedactionPrefs, String> {
    let mut history = load_redaction_history()?;
    history.auto_redact_on_stop = enabled;
    save_redaction_history(&history)?;
    Ok(prefs_from_history(&history))
}

/// Persist which PII / secret category tags are enabled for scrubbing.
#[tauri::command]
pub fn set_enabled_redaction_categories(
    categories: Vec<String>,
) -> Result<RedactionPrefs, String> {
    let known: HashSet<String> = all_category_tags().into_iter().collect();
    let mut enabled: Vec<String> = categories
        .into_iter()
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty() && known.contains(c))
        .collect();
    enabled.sort();
    enabled.dedup();

    let mut history = load_redaction_history()?;
    history.enabled_categories = enabled;
    save_redaction_history(&history)?;
    Ok(prefs_from_history(&history))
}

fn prefs_from_history(history: &RedactionHistory) -> RedactionPrefs {
    RedactionPrefs {
        auto_redact_on_stop: history.auto_redact_on_stop,
        enabled_categories: history.enabled_categories.clone(),
    }
}

fn load_enabled_category_set() -> Result<HashSet<String>, String> {
    Ok(prefs_from_history(&load_redaction_history()?)
        .enabled_categories
        .into_iter()
        .collect())
}

fn append_redaction_run(result: &RedactResult) -> Result<(), String> {
    let mut history = load_redaction_history()?;
    let mut run = result.clone();
    if run.id.trim().is_empty() {
        run.id = new_run_id(&run.completed_at);
    }
    history.runs.insert(0, run);
    if history.runs.len() > MAX_REDACTION_RUNS {
        history.runs.truncate(MAX_REDACTION_RUNS);
    }
    save_redaction_history(&history)
}

fn save_redaction_history(history: &RedactionHistory) -> Result<(), String> {
    JarbasPaths::ensure_directories()?;
    let path = JarbasPaths::redaction_status();
    let body = serde_json::to_string_pretty(history)
        .map_err(|e| format!("Could not encode redaction history: {e}"))?;
    fs::write(&path, body + "\n")
        .map_err(|e| format!("Could not write {}: {e}", path.display()))
}

fn load_redaction_history() -> Result<RedactionHistory, String> {
    let path = JarbasPaths::redaction_status();
    if !path.is_file() {
        return Ok(RedactionHistory::default());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read {}: {e}", path.display()))?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(RedactionHistory::default());
    }

    // Current format: { "runs": [ ... ] }
    if let Ok(history) = serde_json::from_str::<RedactionHistory>(trimmed) {
        return Ok(normalize_history(history));
    }

    // Legacy format: a single RedactResult object.
    if let Ok(mut run) = serde_json::from_str::<RedactResult>(trimmed) {
        if run.id.trim().is_empty() {
            run.id = new_run_id(&run.completed_at);
        }
        return Ok(RedactionHistory {
            runs: vec![run],
            auto_redact_on_stop: true,
            enabled_categories: default_enabled_categories(),
        });
    }

    Err(format!("Could not parse {}", path.display()))
}

fn normalize_history(mut history: RedactionHistory) -> RedactionHistory {
    for run in &mut history.runs {
        if run.id.trim().is_empty() {
            run.id = new_run_id(&run.completed_at);
        }
    }
    let known: HashSet<String> = all_category_tags().into_iter().collect();
    history.enabled_categories = history
        .enabled_categories
        .into_iter()
        .filter(|tag| known.contains(tag))
        .collect();
    history.enabled_categories.sort();
    history.enabled_categories.dedup();
    history
}

fn new_run_id(completed_at: &str) -> String {
    let stamp = completed_at
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>();
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    if stamp.is_empty() {
        format!("redact-{millis}")
    } else {
        format!("redact-{stamp}-{millis}")
    }
}

fn now_rfc3339() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    format_unix_secs_rfc3339(secs)
}

fn format_unix_secs_rfc3339(secs: i64) -> String {
    let secs = secs.max(0) as u64;
    let days = secs / 86_400;
    let day_secs = (secs % 86_400) as u32;
    let hour = day_secs / 3600;
    let min = (day_secs % 3600) / 60;
    let sec = day_secs % 60;

    // Civil date from days since Unix epoch (1970-01-01).
    let (y, m, d) = civil_from_days(days as i64);
    format!("{y:04}-{m:02}-{d:02}T{hour:02}:{min:02}:{sec:02}Z")
}

/// Algorithm from Howard Hinnant (public domain): days since epoch → Y-M-D.
fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

fn redact_query(
    conn: &Connection,
    table: &str,
    id_col: &str,
    text_cols: &[&str],
    redacted_at_col: Option<&str>,
    id_expr: &str,
    text_exprs: &[&str],
    from_where: &str,
    dry_run: bool,
    enabled: &HashSet<String>,
    scanned: &mut u64,
    updated: &mut u64,
    counts: &mut BTreeMap<String, u64>,
) -> Result<(), String> {
    if !table_exists(conn, table)? {
        return Ok(());
    }

    let existing: Vec<(usize, &str)> = text_cols
        .iter()
        .enumerate()
        .filter(|(_, col)| column_exists(conn, table, col).unwrap_or(false))
        .map(|(idx, col)| (idx, *col))
        .collect();
    if existing.is_empty() || !column_exists(conn, table, id_col)? {
        return Ok(());
    }

    let from_where = with_unredacted_filter(conn, table, id_expr, redacted_at_col, from_where)?;

    let projected: Vec<&str> = std::iter::once(id_expr)
        .chain(existing.iter().map(|(idx, _)| text_exprs[*idx]))
        .collect();
    let select_sql = format!("SELECT {} {}", projected.join(", "), from_where);

    let mut stmt = conn
        .prepare(&select_sql)
        .map_err(|e| format!("Could not read {table}: {e}"))?;

    let col_count = existing.len();
    let mapped = stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let mut values = Vec::with_capacity(col_count);
            for i in 0..col_count {
                let value: Option<String> = row.get(i + 1)?;
                values.push(value);
            }
            Ok((id, values))
        })
        .map_err(|e| format!("Could not scan {table}: {e}"))?;

    let mut pending: Vec<(i64, Vec<(String, String)>)> = Vec::new();
    for row in mapped {
        let (id, values) =
            row.map_err(|e| format!("Could not read row from {table}: {e}"))?;

        let mut sets: Vec<(String, String)> = Vec::new();
        for (idx, (_src_idx, col)) in existing.iter().enumerate() {
            let Some(original) = values.get(idx).and_then(|v| v.as_ref()) else {
                continue;
            };
            if original.is_empty() {
                continue;
            }
            *scanned += 1;
            let (redacted, field_counts) = remove_pii_with_counts(original, enabled);
            if redacted != *original {
                for (tag, n) in field_counts {
                    *counts.entry(tag).or_insert(0) += n;
                }
                sets.push(((*col).to_string(), redacted));
            }
        }
        if !sets.is_empty() {
            pending.push((id, sets));
        }
    }
    drop(stmt);

    if dry_run {
        for (_id, sets) in pending {
            *updated += sets.len() as u64;
        }
        return Ok(());
    }

    let now = now_unix_secs();
    let stamp_redacted_at = redacted_at_col
        .filter(|col| column_exists(conn, table, col).unwrap_or(false))
        .map(|col| col.to_string());

    for (id, sets) in pending {
        for (col, value) in &sets {
            let sql = format!("UPDATE {table} SET {col} = ?1 WHERE {id_col} = ?2");
            conn.execute(&sql, rusqlite::params![value, id])
                .map_err(|e| format!("Could not update {table}.{col} row {id}: {e}"))?;
            *updated += 1;
        }
        if let Some(col) = &stamp_redacted_at {
            let sql = format!("UPDATE {table} SET {col} = ?1 WHERE {id_col} = ?2");
            conn.execute(&sql, rusqlite::params![now, id])
                .map_err(|e| format!("Could not stamp {table}.{col} row {id}: {e}"))?;
        }
    }

    Ok(())
}

/// Skip rows already stamped with `redacted_at` when that column exists.
fn with_unredacted_filter(
    conn: &Connection,
    table: &str,
    id_expr: &str,
    redacted_at_col: Option<&str>,
    from_where: &str,
) -> Result<String, String> {
    let Some(col) = redacted_at_col else {
        return Ok(from_where.to_string());
    };
    if !column_exists(conn, table, col)? {
        return Ok(from_where.to_string());
    }
    let qualified = if let Some((alias, _)) = id_expr.split_once('.') {
        format!("{alias}.{col}")
    } else {
        col.to_string()
    };
    Ok(format!("{from_where} AND {qualified} IS NULL"))
}

#[cfg(test)]
fn remove_pii(text: &str) -> String {
    remove_pii_with_counts(text, &all_categories_set()).0
}

#[cfg(test)]
fn all_categories_set() -> HashSet<String> {
    all_category_tags().into_iter().collect()
}

#[cfg(test)]
fn secrets_categories_set() -> HashSet<String> {
    default_enabled_categories().into_iter().collect()
}

fn remove_pii_with_counts(
    text: &str,
    enabled: &HashSet<String>,
) -> (String, BTreeMap<String, u64>) {
    let mut counts: BTreeMap<String, u64> = BTreeMap::new();

    // Preserve password/pin labels; redact only the value.
    let mut sanitized = if enabled.contains("PASSWORD") {
        let password_hits = PASSWORD_CONTEXT.find_iter(text).count() as u64;
        if password_hits > 0 {
            *counts.entry("PASSWORD".into()).or_insert(0) += password_hits;
            PASSWORD_CONTEXT
                .replace_all(text, "$1[PASSWORD]")
                .into_owned()
        } else {
            text.to_string()
        }
    } else {
        text.to_string()
    };

    for (pattern, tag) in PII_RULES.iter() {
        if !enabled.contains(*tag) {
            continue;
        }
        let hits = pattern.find_iter(&sanitized).count() as u64;
        if hits == 0 {
            continue;
        }
        *counts.entry((*tag).to_string()).or_insert(0) += hits;
        let replacement = format!("[{tag}]");
        sanitized = pattern
            .replace_all(&sanitized, replacement.as_str())
            .into_owned();
    }

    (sanitized, counts)
}

fn table_exists(conn: &Connection, table: &str) -> Result<bool, String> {
    let exists: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1",
            [table],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Could not inspect tables: {e}"))?;
    Ok(exists.is_some())
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
    // PRAGMA table_info cannot bind table name; table is allow-listed by callers.
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|e| format!("Could not inspect {table} columns: {e}"))?;
    let mut rows = stmt
        .query([])
        .map_err(|e| format!("Could not read {table} columns: {e}"))?;
    while let Some(row) = rows
        .next()
        .map_err(|e| format!("Could not read {table} column row: {e}"))?
    {
        let name: String = row
            .get(1)
            .map_err(|e| format!("Could not read column name: {e}"))?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn first_existing_column(
    conn: &Connection,
    table: &str,
    candidates: &[&str],
) -> Result<Option<String>, String> {
    for col in candidates {
        if column_exists(conn, table, col)? {
            return Ok(Some((*col).to_string()));
        }
    }
    Ok(None)
}

fn now_unix_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::{
        all_categories_set, remove_pii, remove_pii_with_counts, secrets_categories_set,
    };
    use std::collections::HashSet;

    #[test]
    fn redacts_email_and_key() {
        let input = "email me at ada@example.com with sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789abcd";
        let out = remove_pii(input);
        assert!(out.contains("[EMAIL]"));
        assert!(out.contains("[ANTHROPIC_KEY]") || out.contains("[OPENAI_KEY]") || out.contains("[API_KEY]"));
        assert!(!out.contains("ada@example.com"));
    }

    #[test]
    fn redacts_password_value_keeps_label() {
        let out = remove_pii("password: hunter2");
        assert!(out.contains("password"));
        assert!(out.contains("[PASSWORD]"));
        assert!(!out.contains("hunter2"));
    }

    #[test]
    fn counts_matches_by_category() {
        let input = "ada@example.com and bob@example.com password: secret";
        let (_out, counts) = remove_pii_with_counts(input, &all_categories_set());
        assert_eq!(counts.get("EMAIL"), Some(&2));
        assert_eq!(counts.get("PASSWORD"), Some(&1));
    }

    #[test]
    fn respects_enabled_categories() {
        let input = "ada@example.com password: secret";
        let only_email: HashSet<String> = ["EMAIL".into()].into_iter().collect();
        let (out, counts) = remove_pii_with_counts(input, &only_email);
        assert!(out.contains("[EMAIL]"));
        assert!(out.contains("secret"));
        assert_eq!(counts.get("EMAIL"), Some(&1));
        assert!(counts.get("PASSWORD").is_none());
    }

    #[test]
    fn secrets_tier_skips_email_pii() {
        let input = "ada@example.com password: hunter2";
        let (out, counts) = remove_pii_with_counts(input, &secrets_categories_set());
        assert!(out.contains("ada@example.com"));
        assert!(out.contains("[PASSWORD]"));
        assert!(counts.get("EMAIL").is_none());
        assert_eq!(counts.get("PASSWORD"), Some(&1));
    }

    #[test]
    fn secrets_tier_avoids_broad_api_key_false_positives() {
        // Looks like a product SKU / identifier, not a live secret.
        let input = "Order key-shipping-label-2024 for customer";
        let (out, counts) = remove_pii_with_counts(input, &secrets_categories_set());
        assert_eq!(out, input);
        assert!(counts.get("API_KEY").is_none());
        assert!(counts.get("ENV_SECRET").is_none());
    }

    #[test]
    fn aggressive_tier_can_match_broad_api_key_pattern() {
        let input = "token_abcdefghijklmnopqrstuvwxyz";
        let (out, counts) = remove_pii_with_counts(input, &all_categories_set());
        assert!(
            counts.get("API_KEY").is_some() || out.contains("[API_KEY]"),
            "aggressive should allow broad token patterns: {out} {counts:?}"
        );
    }
}
