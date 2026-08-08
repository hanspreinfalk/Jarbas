//! Persisted capture privacy filters (ignored apps/windows/URLs).
//!
//! Filters are passed into Screenpipe on start. Because the SDK fail-opens
//! without Accessibility (and can miss some browser/URL cases), we also
//! enforce locally by purging matching rows from `~/.jarbas/db.sqlite`.

use crate::paths::JarbasPaths;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CaptureFilters {
    /// Substring patterns matched case-insensitively against focused app
    /// name and window title. Supports `App::Title` scoping.
    #[serde(default)]
    pub ignored_windows: Vec<String>,
    /// Domain-aware URL patterns; skip while the focused browser matches.
    #[serde(default)]
    pub ignored_urls: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PurgeIgnoredResult {
    pub deleted_frames: u64,
    pub deleted_ui_events: u64,
    pub deleted_snapshots: u64,
}

fn normalize_patterns(items: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = items
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    out.sort_by_key(|s| s.to_ascii_lowercase());
    out.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
    out
}

/// Host label used as an extra window-title pattern, e.g. `instagram.com` → `instagram`.
fn window_hint_from_url_pattern(pattern: &str) -> Option<String> {
    let raw = pattern
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("www.")
        .trim_matches('/');
    if raw.is_empty() {
        return None;
    }
    let host = raw.split('/').next().unwrap_or(raw);
    let label = host.split('.').next().unwrap_or(host).trim();
    if label.is_empty() || label.eq_ignore_ascii_case("www") {
        return None;
    }
    Some(label.to_string())
}

fn load_filters() -> Result<CaptureFilters, String> {
    let path = JarbasPaths::capture_filters();
    if !path.is_file() {
        return Ok(CaptureFilters::default());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read capture filters: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(CaptureFilters::default());
    }
    let mut filters: CaptureFilters = serde_json::from_str(&raw)
        .map_err(|e| format!("Could not parse capture filters: {e}"))?;
    filters.ignored_windows = normalize_patterns(filters.ignored_windows);
    filters.ignored_urls = normalize_patterns(filters.ignored_urls);
    Ok(filters)
}

fn save_filters(filters: &CaptureFilters) -> Result<(), String> {
    let path = JarbasPaths::capture_filters();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create capture filters dir: {e}"))?;
    }
    let raw = serde_json::to_string_pretty(filters)
        .map_err(|e| format!("Could not serialize capture filters: {e}"))?;
    fs::write(&path, raw).map_err(|e| format!("Could not write capture filters: {e}"))
}

/// Read persisted ignore lists (empty when unset).
#[tauri::command]
pub fn get_capture_filters() -> Result<CaptureFilters, String> {
    load_filters()
}

/// Replace ignored app/window and URL patterns, then purge matching local rows.
#[tauri::command]
pub fn set_capture_filters(
    ignored_windows: Vec<String>,
    ignored_urls: Vec<String>,
) -> Result<CaptureFilters, String> {
    let filters = CaptureFilters {
        ignored_windows: normalize_patterns(ignored_windows),
        ignored_urls: normalize_patterns(ignored_urls),
    };
    save_filters(&filters)?;
    let _ = purge_ignored_capture_data(&filters);
    Ok(filters)
}

/// Best-effort local enforcement after a recording stops.
pub fn purge_ignored_after_stop() {
    let Ok(filters) = load_filters() else {
        return;
    };
    let _ = purge_ignored_capture_data(&filters);
}

/// Inject persisted filters into Screenpipe start options (prefs win).
/// Only send lists when non-empty so the recorder stays on the zero-overhead
/// path when nothing is ignored. Also mirrors URL hosts into window patterns
/// as a belt-and-suspenders signal for the native filter.
pub fn merge_into_start_options(options: &mut serde_json::Map<String, serde_json::Value>) {
    let Ok(filters) = load_filters() else {
        return;
    };

    let mut windows = filters.ignored_windows.clone();
    for url in &filters.ignored_urls {
        if let Some(hint) = window_hint_from_url_pattern(url) {
            if !windows
                .iter()
                .any(|existing| existing.eq_ignore_ascii_case(&hint))
            {
                windows.push(hint);
            }
        }
    }
    windows = normalize_patterns(windows);

    if !windows.is_empty() {
        options.insert(
            "ignoredWindows".into(),
            serde_json::Value::Array(
                windows
                    .into_iter()
                    .map(serde_json::Value::String)
                    .collect(),
            ),
        );
    }
    if !filters.ignored_urls.is_empty() {
        options.insert(
            "ignoredUrls".into(),
            serde_json::Value::Array(
                filters
                    .ignored_urls
                    .into_iter()
                    .map(serde_json::Value::String)
                    .collect(),
            ),
        );
    }
}

fn purge_ignored_capture_data(filters: &CaptureFilters) -> Result<PurgeIgnoredResult, String> {
    if filters.ignored_windows.is_empty() && filters.ignored_urls.is_empty() {
        return Ok(PurgeIgnoredResult::default());
    }

    let db_path = JarbasPaths::root().join("db.sqlite");
    if !db_path.is_file() {
        return Ok(PurgeIgnoredResult::default());
    }

    let mut conn = Connection::open(&db_path)
        .map_err(|e| format!("Could not open capture database: {e}"))?;
    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| format!("Could not set database busy timeout: {e}"))?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Could not start purge transaction: {e}"))?;

    let mut deleted_frames = 0u64;
    let mut deleted_ui_events = 0u64;
    let mut deleted_snapshots = 0u64;

    if table_exists(&tx, "frames")? {
        let frame_ids = matching_frame_ids(&tx, filters)?;
        deleted_frames = frame_ids.len() as u64;

        // Collect snapshot paths before deleting rows.
        let mut snapshot_paths: Vec<String> = Vec::new();
        if column_exists(&tx, "frames", "snapshot_path")? {
            for id in &frame_ids {
                let path: Option<String> = tx
                    .query_row(
                        "SELECT snapshot_path FROM frames WHERE id = ?1",
                        [id],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| format!("Could not read snapshot path: {e}"))?;
                if let Some(path) = path.filter(|p| !p.trim().is_empty()) {
                    snapshot_paths.push(path);
                }
            }
        }

        if !frame_ids.is_empty() {
            if table_exists(&tx, "elements")? {
                delete_by_frame_ids(&tx, "elements", "frame_id", &frame_ids)?;
            }
            if table_exists(&tx, "ocr_text")? {
                delete_by_frame_ids(&tx, "ocr_text", "frame_id", &frame_ids)?;
            }
            delete_by_frame_ids(&tx, "frames", "id", &frame_ids)?;
        }

        for path in snapshot_paths {
            if remove_file_if_exists(Path::new(&path)) {
                deleted_snapshots += 1;
            }
        }
    }

    if table_exists(&tx, "ui_events")? {
        deleted_ui_events = delete_matching_ui_events(&tx, filters)?;
    }

    tx.commit()
        .map_err(|e| format!("Could not commit ignored-capture purge: {e}"))?;

    Ok(PurgeIgnoredResult {
        deleted_frames,
        deleted_ui_events,
        deleted_snapshots,
    })
}

fn matching_frame_ids(
    conn: &Connection,
    filters: &CaptureFilters,
) -> Result<Vec<i64>, String> {
    let mut ids = Vec::new();
    let has_app = column_exists(conn, "frames", "app_name")?;
    let has_window = column_exists(conn, "frames", "window_name")?;
    let has_url = column_exists(conn, "frames", "browser_url")?;

    let mut sql = String::from("SELECT id FROM frames WHERE 0");
    let mut params: Vec<String> = Vec::new();

    for pattern in &filters.ignored_windows {
        let like = format!("%{}%", pattern.to_ascii_lowercase());
        if has_app {
            sql.push_str(" OR lower(COALESCE(app_name,'')) LIKE ?");
            params.push(like.clone());
        }
        if has_window {
            sql.push_str(" OR lower(COALESCE(window_name,'')) LIKE ?");
            params.push(like);
        }
    }
    for pattern in &filters.ignored_urls {
        if !has_url {
            break;
        }
        let like = format!("%{}%", pattern.to_ascii_lowercase());
        sql.push_str(" OR lower(COALESCE(browser_url,'')) LIKE ?");
        params.push(like);
        if let Some(hint) = window_hint_from_url_pattern(pattern) {
            let hint_like = format!("%{}%", hint.to_ascii_lowercase());
            if has_window {
                sql.push_str(" OR lower(COALESCE(window_name,'')) LIKE ?");
                params.push(hint_like.clone());
            }
            if has_app {
                sql.push_str(" OR lower(COALESCE(app_name,'')) LIKE ?");
                params.push(hint_like);
            }
        }
    }

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Could not prepare frame purge query: {e}"))?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params
        .iter()
        .map(|p| p as &dyn rusqlite::types::ToSql)
        .collect();
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| row.get::<_, i64>(0))
        .map_err(|e| format!("Could not scan frames for purge: {e}"))?;
    for row in rows {
        ids.push(row.map_err(|e| format!("Could not read frame id: {e}"))?);
    }
    ids.sort_unstable();
    ids.dedup();
    Ok(ids)
}

fn delete_matching_ui_events(
    conn: &Connection,
    filters: &CaptureFilters,
) -> Result<u64, String> {
    let has_app = column_exists(conn, "ui_events", "app_name")?;
    let window_col = if column_exists(conn, "ui_events", "window_title")? {
        "window_title"
    } else if column_exists(conn, "ui_events", "window_name")? {
        "window_name"
    } else {
        ""
    };
    let has_window = !window_col.is_empty();
    let has_url = column_exists(conn, "ui_events", "browser_url")?;

    let mut sql = String::from("DELETE FROM ui_events WHERE 0");
    let mut params: Vec<String> = Vec::new();

    for pattern in &filters.ignored_windows {
        let like = format!("%{}%", pattern.to_ascii_lowercase());
        if has_app {
            sql.push_str(" OR lower(COALESCE(app_name,'')) LIKE ?");
            params.push(like.clone());
        }
        if has_window && !window_col.is_empty() {
            sql.push_str(&format!(" OR lower(COALESCE({window_col},'')) LIKE ?"));
            params.push(like);
        }
    }
    for pattern in &filters.ignored_urls {
        let like = format!("%{}%", pattern.to_ascii_lowercase());
        if has_url {
            sql.push_str(" OR lower(COALESCE(browser_url,'')) LIKE ?");
            params.push(like.clone());
        }
        if let Some(hint) = window_hint_from_url_pattern(pattern) {
            let hint_like = format!("%{}%", hint.to_ascii_lowercase());
            if has_window && !window_col.is_empty() {
                sql.push_str(&format!(" OR lower(COALESCE({window_col},'')) LIKE ?"));
                params.push(hint_like.clone());
            }
            if has_app {
                sql.push_str(" OR lower(COALESCE(app_name,'')) LIKE ?");
                params.push(hint_like);
            }
        }
    }

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Could not prepare ui_events purge: {e}"))?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params
        .iter()
        .map(|p| p as &dyn rusqlite::types::ToSql)
        .collect();
    let deleted = stmt
        .execute(param_refs.as_slice())
        .map_err(|e| format!("Could not purge ui_events: {e}"))?;
    Ok(deleted as u64)
}

fn delete_by_frame_ids(
    conn: &Connection,
    table: &str,
    id_col: &str,
    ids: &[i64],
) -> Result<(), String> {
    // Chunk to stay under SQLite variable limits.
    for chunk in ids.chunks(400) {
        let placeholders = std::iter::repeat("?")
            .take(chunk.len())
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!("DELETE FROM {table} WHERE {id_col} IN ({placeholders})");
        let params: Vec<&dyn rusqlite::types::ToSql> = chunk
            .iter()
            .map(|id| id as &dyn rusqlite::types::ToSql)
            .collect();
        conn.execute(&sql, params.as_slice())
            .map_err(|e| format!("Could not delete from {table}: {e}"))?;
    }
    Ok(())
}

fn remove_file_if_exists(path: &Path) -> bool {
    match fs::remove_file(path) {
        Ok(()) => true,
        Err(_) => false,
    }
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

#[cfg(test)]
mod tests {
    use super::{normalize_patterns, window_hint_from_url_pattern};

    #[test]
    fn normalize_trims_dedupes_case_insensitive() {
        let out = normalize_patterns(vec![
            "  WhatsApp ".into(),
            "whatsapp".into(),
            "".into(),
            "Signal".into(),
        ]);
        assert_eq!(out, vec!["Signal".to_string(), "WhatsApp".to_string()]);
    }

    #[test]
    fn url_hint_extracts_host_label() {
        assert_eq!(
            window_hint_from_url_pattern("instagram.com").as_deref(),
            Some("instagram")
        );
        assert_eq!(
            window_hint_from_url_pattern("https://www.instagram.com/foo").as_deref(),
            Some("instagram")
        );
    }
}
