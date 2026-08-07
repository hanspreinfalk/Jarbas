//! Wipe or trim local data under `~/.jarbas`.

use crate::paths::JarbasPaths;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetResult {
    mode: String,
    deleted_videos: u64,
    deleted_frames: u64,
    deleted_snapshot_dirs: u64,
    deleted_analysis_items: u64,
    deleted_analysis_runs: u64,
    message: String,
}

/// `mode`: `"full"` wipes `~/.jarbas`; `"range"` deletes capture + analysis in `[startDate, endDate]`.
#[tauri::command]
pub fn reset_jarbas_data(
    mode: String,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<ResetResult, String> {
    let mode = mode.trim().to_ascii_lowercase();
    match mode.as_str() {
        "full" => reset_full(),
        "range" => {
            let start = start_date
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "startDate is required for range delete.".to_string())?;
            let end = end_date
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| "endDate is required for range delete.".to_string())?;
            if !is_ymd(start) || !is_ymd(end) {
                return Err("Dates must be YYYY-MM-DD.".into());
            }
            if start > end {
                return Err("startDate must be on or before endDate.".into());
            }
            reset_range(start, end)
        }
        _ => Err(format!("Unknown reset mode: {mode}")),
    }
}

fn reset_full() -> Result<ResetResult, String> {
    let root = JarbasPaths::root();
    if root.exists() {
        // Remove children first so a locked file fails loudly without leaving a half-missing tree
        // when possible; fall back to removing the root.
        if let Ok(entries) = fs::read_dir(&root) {
            for entry in entries.flatten() {
                let path = entry.path();
                let _ = remove_path(&path);
            }
        }
        if root.exists() {
            let _ = remove_path(&root);
        }
    }

    JarbasPaths::ensure_directories()?;

    Ok(ResetResult {
        mode: "full".into(),
        deleted_videos: 0,
        deleted_frames: 0,
        deleted_snapshot_dirs: 0,
        deleted_analysis_items: 0,
        deleted_analysis_runs: 0,
        message: format!(
            "Cleared {}. Folders recreated. Assistant will reinstall on next launch.",
            root.display()
        ),
    })
}

fn reset_range(start: &str, end: &str) -> Result<ResetResult, String> {
    JarbasPaths::ensure_directories()?;

    let start_ms = ymd_start_ms(start).ok_or_else(|| format!("Invalid startDate: {start}"))?;
    let end_ms = ymd_end_ms(end).ok_or_else(|| format!("Invalid endDate: {end}"))?;

    let deleted_videos = delete_videos_in_range(start_ms, end_ms)?;
    let deleted_snapshot_dirs = delete_snapshot_dirs_in_range(start, end)?;
    let deleted_frames = delete_db_rows_in_range(start_ms, end_ms)?;
    let deleted_analysis_items = delete_analysis_items_in_range(start, end)?;
    let deleted_analysis_runs = delete_analysis_runs_in_range(start, end)?;

    // Drop sqlite sidecars so the next open starts clean if the DB was emptied mid-WAL.
    let _ = fs::remove_file(JarbasPaths::root().join("db.sqlite-shm"));
    let _ = fs::remove_file(JarbasPaths::root().join("db.sqlite-wal"));

    Ok(ResetResult {
        mode: "range".into(),
        deleted_videos,
        deleted_frames,
        deleted_snapshot_dirs,
        deleted_analysis_items,
        deleted_analysis_runs,
        message: format!(
            "Removed data from {start} → {end}: {deleted_videos} videos, {deleted_frames} frames, {deleted_snapshot_dirs} snapshot days, {deleted_analysis_items} analysis items."
        ),
    })
}

fn delete_videos_in_range(start_ms: u64, end_ms: u64) -> Result<u64, String> {
    let dir = JarbasPaths::videos_dir();
    let Ok(entries) = fs::read_dir(&dir) else {
        return Ok(0);
    };
    let mut deleted = 0u64;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with("jarbas-") || !name.ends_with(".mp4") {
            continue;
        }
        let Some(stem) = session_stem_from_mp4(&name) else {
            continue;
        };
        let Some(ms) = parse_mp4_stem_millis(&stem) else {
            continue;
        };
        if ms < start_ms || ms > end_ms {
            continue;
        }
        if remove_path(&path).is_ok() {
            deleted += 1;
        }
    }
    Ok(deleted)
}

fn delete_snapshot_dirs_in_range(start: &str, end: &str) -> Result<u64, String> {
    let data = JarbasPaths::root().join("data");
    let Ok(entries) = fs::read_dir(&data) else {
        return Ok(0);
    };
    let mut deleted = 0u64;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_ymd(&name) {
            continue;
        }
        if name.as_str() < start || name.as_str() > end {
            continue;
        }
        if remove_path(&path).is_ok() {
            deleted += 1;
        }
    }
    Ok(deleted)
}

fn delete_db_rows_in_range(start_ms: u64, end_ms: u64) -> Result<u64, String> {
    let db = JarbasPaths::root().join("db.sqlite");
    if !db.is_file() {
        return Ok(0);
    }

    let start_iso = format_millis_iso(start_ms);
    let end_iso = format_millis_iso(end_ms);

    // Count first so we can report.
    let count_sql = format!(
        "SELECT COUNT(*) FROM frames WHERE timestamp >= '{start_iso}' AND timestamp <= '{end_iso}';"
    );
    let deleted_frames = run_sqlite_scalar(&db, &count_sql).unwrap_or(0);

    // Best-effort related cleanup. Ignore missing-table errors.
    let deletes = [
        format!(
            "DELETE FROM elements WHERE frame_id IN (SELECT id FROM frames WHERE timestamp >= '{start_iso}' AND timestamp <= '{end_iso}');"
        ),
        format!(
            "DELETE FROM ocr_text WHERE frame_id IN (SELECT id FROM frames WHERE timestamp >= '{start_iso}' AND timestamp <= '{end_iso}');"
        ),
        format!(
            "DELETE FROM ui_events WHERE timestamp >= '{start_iso}' AND timestamp <= '{end_iso}';"
        ),
        format!(
            "DELETE FROM frames WHERE timestamp >= '{start_iso}' AND timestamp <= '{end_iso}';"
        ),
    ];
    for sql in deletes {
        let _ = run_sqlite(&db, &sql);
    }

    Ok(deleted_frames)
}

fn delete_analysis_items_in_range(start: &str, end: &str) -> Result<u64, String> {
    let mut deleted = 0u64;
    for dir in [
        JarbasPaths::insights_dir(),
        JarbasPaths::opportunities_dir(),
        JarbasPaths::reports_dir(),
    ] {
        deleted += delete_json_items_in_dir(&dir, start, end)?;
    }
    Ok(deleted)
}

fn delete_json_items_in_dir(dir: &Path, start: &str, end: &str) -> Result<u64, String> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Ok(0);
    };
    let mut deleted = 0u64;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<Value>(&raw) else {
            continue;
        };
        if !analysis_item_overlaps(&value, start, end) {
            continue;
        }
        if remove_path(&path).is_ok() {
            deleted += 1;
        }
    }
    Ok(deleted)
}

fn analysis_item_overlaps(value: &Value, start: &str, end: &str) -> bool {
    let item_start = value
        .get("startDate")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| is_ymd(s));
    let item_end = value
        .get("endDate")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| is_ymd(s))
        .or(item_start);

    if let (Some(a), Some(b)) = (item_start, item_end) {
        // Ranges overlap if a <= end && b >= start.
        return a <= end && b >= start;
    }

    // Fallback: createdAt ISO prefix, or file not overlapping → keep.
    if let Some(created) = value.get("createdAt").and_then(|v| v.as_str()) {
        if created.len() >= 10 && is_ymd(&created[..10]) {
            let day = &created[..10];
            return day >= start && day <= end;
        }
    }
    false
}

fn delete_analysis_runs_in_range(start: &str, end: &str) -> Result<u64, String> {
    let dir = JarbasPaths::analysis_runs_dir();
    let Ok(entries) = fs::read_dir(&dir) else {
        return Ok(0);
    };
    let mut deleted = 0u64;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let overlaps = fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
            .map(|value| analysis_item_overlaps(&value, start, end))
            .unwrap_or(false);
        if !overlaps {
            // Also drop by mtime day if JSON has no dates.
            if let Some(day) = file_mtime_ymd(&path) {
                if day.as_str() < start || day.as_str() > end {
                    continue;
                }
            } else {
                continue;
            }
        }
        if remove_path(&path).is_ok() {
            deleted += 1;
        }
    }
    Ok(deleted)
}

fn file_mtime_ymd(path: &Path) -> Option<String> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    let ms = modified.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64;
    Some(format_millis_ymd(ms))
}

fn remove_path(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        fs::remove_dir_all(path)
            .map_err(|e| format!("Could not remove {}: {e}", path.display()))
    } else if path.exists() || path.is_symlink() {
        fs::remove_file(path).map_err(|e| format!("Could not remove {}: {e}", path.display()))
    } else {
        Ok(())
    }
}

fn is_ymd(value: &str) -> bool {
    if value.len() != 10 {
        return false;
    }
    let bytes = value.as_bytes();
    bytes[4] == b'-'
        && bytes[7] == b'-'
        && value[..4].chars().all(|c| c.is_ascii_digit())
        && value[5..7].chars().all(|c| c.is_ascii_digit())
        && value[8..10].chars().all(|c| c.is_ascii_digit())
}

fn ymd_start_ms(ymd: &str) -> Option<u64> {
    parse_iso_millis(&format!("{ymd}T00:00:00.000Z"))
}

fn ymd_end_ms(ymd: &str) -> Option<u64> {
    parse_iso_millis(&format!("{ymd}T23:59:59.999Z"))
}

fn run_sqlite(db: &Path, sql: &str) -> Result<(), String> {
    let output = std::process::Command::new("sqlite3")
        .arg(db)
        .arg(sql)
        .output()
        .map_err(|e| format!("sqlite3 failed: {e}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

fn run_sqlite_scalar(db: &Path, sql: &str) -> Option<u64> {
    let output = std::process::Command::new("sqlite3")
        .arg(db)
        .arg(sql)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .ok()
}

fn session_stem_from_mp4(name: &str) -> Option<String> {
    let without_ext = name.strip_suffix(".mp4")?;
    let stem = without_ext
        .rsplit_once("-monitor-")
        .map(|(prefix, _)| prefix)
        .unwrap_or(without_ext);
    stem.strip_prefix("jarbas-").map(str::to_owned)
}

fn parse_mp4_stem_millis(stem: &str) -> Option<u64> {
    let (date, rest) = stem.split_once('T')?;
    let rest = rest.strip_suffix('Z').unwrap_or(rest);
    let parts: Vec<&str> = rest.split('-').collect();
    if parts.len() < 4 {
        return None;
    }
    let iso = format!(
        "{date}T{:0>2}:{:0>2}:{:0>2}.{}Z",
        parts[0], parts[1], parts[2], parts[3]
    );
    parse_iso_millis(&iso)
}

fn parse_iso_millis(value: &str) -> Option<u64> {
    let normalized = value.trim().replace("+00:00", "Z");
    let normalized = if normalized.ends_with('Z') {
        normalized
    } else {
        format!("{normalized}Z")
    };
    // Minimal parser: YYYY-MM-DDTHH:MM:SS(.fff)Z
    let (date, time) = normalized.split_once('T')?;
    let time = time.trim_end_matches('Z');
    let (hms, frac) = match time.split_once('.') {
        Some((hms, frac)) => (hms, Some(frac)),
        None => (time, None),
    };
    let mut d = date.split('-');
    let year: i32 = d.next()?.parse().ok()?;
    let month: u32 = d.next()?.parse().ok()?;
    let day: u32 = d.next()?.parse().ok()?;
    let mut t = hms.split(':');
    let hour: u32 = t.next()?.parse().ok()?;
    let minute: u32 = t.next()?.parse().ok()?;
    let second: u32 = t.next()?.parse().ok()?;
    let millis: u32 = frac
        .map(|f| {
            let digits: String = f.chars().take(3).collect();
            format!("{:0<3}", digits).parse().unwrap_or(0)
        })
        .unwrap_or(0);

    days_from_civil(year, month, day).map(|days| {
        let secs = days
            .saturating_mul(86_400)
            .saturating_add(hour as i64 * 3600)
            .saturating_add(minute as i64 * 60)
            .saturating_add(second as i64);
        (secs as u64).saturating_mul(1000).saturating_add(millis as u64)
    })
}

fn days_from_civil(year: i32, month: u32, day: u32) -> Option<i64> {
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    // Howard Hinnant civil_from_days inverse.
    let y = if month <= 2 { year - 1 } else { year };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u32;
    let m = month as i64;
    let d = day as i64;
    let mp = if m > 2 { m - 3 } else { m + 9 };
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = (yoe as i64) * 365 + (yoe as i64) / 4 - (yoe as i64) / 100 + doy;
    Some(era as i64 * 146_097 + doe - 719_468)
}

fn format_millis_iso(ms: u64) -> String {
    let total_secs = (ms / 1000) as i64;
    let millis = (ms % 1000) as u32;
    let days = total_secs.div_euclid(86_400);
    let tod = total_secs.rem_euclid(86_400) as u32;
    let (year, month, day) = civil_from_days(days);
    let hour = tod / 3600;
    let minute = (tod % 3600) / 60;
    let second = tod % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

fn format_millis_ymd(ms: u64) -> String {
    let total_secs = (ms / 1000) as i64;
    let days = total_secs.div_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02}")
}

fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = (yoe as i32) + (era as i32) * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { y + 1 } else { y };
    (year, month, day)
}
