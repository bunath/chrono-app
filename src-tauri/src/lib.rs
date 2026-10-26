use once_cell::sync::OnceCell;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

// ── Base de données ───────────────────────────────────────────
static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

fn init_db(app: &AppHandle) {
    let dir = app.path().app_data_dir().expect("app_data_dir");
    std::fs::create_dir_all(&dir).ok();
    let path = dir.join("chrono.db");
    let conn = Connection::open(&path).expect("open db");
    conn.execute_batch("
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS timer_presets (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT    NOT NULL,
            secs INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    ").expect("init tables");
    DB.set(Mutex::new(conn)).ok();
}

fn db() -> std::sync::MutexGuard<'static, Connection> {
    DB.get().expect("db not init").lock().unwrap()
}

// ── Types ─────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TimerPreset { pub id: i64, pub name: String, pub secs: i64 }

// ── Commandes DB ──────────────────────────────────────────────
#[tauri::command]
fn db_get_setting(key: String) -> Option<String> {
    db().query_row("SELECT value FROM settings WHERE key=?1", params![key],
        |r| r.get(0)).ok()
}

#[tauri::command]
fn db_set_setting(key: String, val: String) {
    db().execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?1,?2)",
        params![key, val]).ok();
}

#[tauri::command]
fn db_get_presets() -> Vec<TimerPreset> {
    let d = db();
    let mut stmt = d.prepare(
        "SELECT id,name,secs FROM timer_presets ORDER BY id").unwrap();
    stmt.query_map([], |r| Ok(TimerPreset {
        id: r.get(0)?, name: r.get(1)?, secs: r.get(2)?,
    })).unwrap().filter_map(|r| r.ok()).collect()
}

#[tauri::command]
fn db_save_preset(name: String, secs: i64) -> TimerPreset {
    let d = db();
    d.execute("INSERT INTO timer_presets(name,secs) VALUES(?1,?2)",
        params![name, secs]).unwrap();
    let id = d.last_insert_rowid();
    TimerPreset { id, name, secs }
}

#[tauri::command]
fn db_delete_preset(id: i64) {
    db().execute("DELETE FROM timer_presets WHERE id=?1", params![id]).ok();
}

// ── Fichier musique ────────────────────────────────────────────
#[tauri::command]
async fn pick_music_file(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file()
        .add_filter("Audio", &["mp3","wav","ogg","flac","aac","m4a","opus","wma"])
        .pick_file(move |f| { tx.send(f).ok(); });
    rx.recv().ok()?.map(|p| p.to_string())
}

// ── Dossier Téléchargements (sans dépendance externe) ─────────
fn downloads_dir() -> PathBuf {
    // Windows : USERPROFILE\Downloads, fallback HOME\Downloads, fallback .
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(|h| PathBuf::from(h).join("Downloads"))
        .unwrap_or_else(|_| PathBuf::from("."))
}

// ── Téléchargement MAJ ────────────────────────────────────────
static DOWNLOAD_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();

fn dl_path() -> std::sync::MutexGuard<'static, Option<PathBuf>> {
    DOWNLOAD_PATH.get_or_init(|| Mutex::new(None)).lock().unwrap()
}

#[tauri::command]
async fn download_update(url: String, version: String, app: AppHandle) -> Result<(), String> {
    let dest = downloads_dir().join(format!("Chrono-Setup-{}.exe", version));

    let client = reqwest::Client::new();
    let resp = client.get(&url)
        .header("User-Agent", "chrono/1.5")
        .send().await.map_err(|e| e.to_string())?;

    let total = resp.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&dest).await.map_err(|e| e.to_string())?;
    let mut received: u64 = 0;

    use tokio::io::AsyncWriteExt;
    let mut stream = resp;
    while let Some(chunk) = stream.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        let pct = if total > 0 { received * 100 / total } else { 0 };
        app.emit("update-progress", serde_json::json!({
            "percent": pct, "received": received, "total": total
        })).ok();
    }
    file.flush().await.map_err(|e| e.to_string())?;

    *dl_path() = Some(dest);
    app.emit("update-progress", serde_json::json!({"percent":100,"status":"done"})).ok();
    Ok(())
}

#[tauri::command]
fn launch_installer() {
    if let Some(path) = dl_path().clone() {
        std::process::Command::new(&path).spawn().ok();
        std::thread::sleep(std::time::Duration::from_millis(1500));
        std::process::exit(0);
    }
}

#[tauri::command]
fn cancel_download() {
    if let Some(path) = dl_path().clone() {
        std::fs::remove_file(path).ok();
    }
    *dl_path() = None;
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ── Helper : nom du moniteur en &str ─────────────────────────
fn monitor_name(m: &tauri::Monitor) -> &str {
    m.name().map(|s| s.as_str()).unwrap_or("")
}

// ── Écrans secondaires ────────────────────────────────────────
#[tauri::command]
fn get_displays(app: AppHandle) -> serde_json::Value {
    let monitors = app.available_monitors().unwrap_or_default();
    let primary  = app.primary_monitor().ok().flatten();
    let pname    = primary.as_ref().map(|m| monitor_name(m).to_owned());

    let list: Vec<_> = monitors.iter().enumerate().map(|(i, m)| {
        let name       = monitor_name(m);
        let is_primary = pname.as_deref() == Some(name);
        serde_json::json!({
            "index": i,
            "isPrimary": is_primary,
            "label": format!("Écran {}{}", i+1, if is_primary {" (principal)"} else {""}),
            "bounds": {
                "x": m.position().x,
                "y": m.position().y,
                "width":  m.size().width,
                "height": m.size().height
            }
        })
    }).collect();
    serde_json::json!(list)
}

#[tauri::command]
fn move_to_second_screen(app: AppHandle) -> serde_json::Value {
    let monitors = app.available_monitors().unwrap_or_default();
    let primary  = app.primary_monitor().ok().flatten();
    let pname    = primary.as_ref().map(|m| monitor_name(m).to_owned());

    let secondary = monitors.iter().find(|m| {
        pname.as_deref() != Some(monitor_name(m))
    });

    if let Some(mon) = secondary {
        let pos  = mon.position();
        let size = mon.size();
        if let Some(win) = app.get_webview_window("main") {
            win.set_position(tauri::PhysicalPosition::new(pos.x, pos.y)).ok();
            win.set_size(tauri::PhysicalSize::new(size.width, size.height)).ok();
            win.set_fullscreen(true).ok();
        }
        return serde_json::json!({"ok": true});
    }
    serde_json::json!({"ok": false, "reason": "single_screen"})
}

#[tauri::command]
fn restore_primary_screen(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        win.set_fullscreen(false).ok();
        win.set_size(tauri::LogicalSize::new(1280.0_f64, 860.0_f64)).ok();
        win.center().ok();
    }
}

// ── Setup ─────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            init_db(app.handle());
            // La fenêtre est visible:true dans tauri.conf.json
            // On force le focus au cas où
            if let Some(win) = app.get_webview_window("main") {
                win.set_focus().ok();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_get_setting, db_set_setting,
            db_get_presets, db_save_preset, db_delete_preset,
            pick_music_file,
            download_update, launch_installer, cancel_download,
            get_app_version,
            get_displays, move_to_second_screen, restore_primary_screen,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur Tauri");
}
