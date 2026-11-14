use once_cell::sync::OnceCell;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

// â”€â”€ Base de donnÃ©es â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

fn init_db(app: &AppHandle) {
    let dir = app.path().app_data_dir().expect("app_data_dir");
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("chrono.db");
    let conn = Connection::open(&path).expect("open db");
    conn.execute_batch(
        "
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
    ",
    )
    .expect("init tables");
    let _ = DB.set(Mutex::new(conn));
}

fn db() -> std::sync::MutexGuard<'static, Connection> {
    DB.get().expect("db not init").lock().unwrap()
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TimerPreset {
    pub id: i64,
    pub name: String,
    pub secs: i64,
}

// â”€â”€ Commandes DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#[tauri::command]
fn db_get_setting(key: String) -> Option<String> {
    db().query_row(
        "SELECT value FROM settings WHERE key=?1",
        params![key],
        |r| r.get(0),
    )
    .ok()
}

#[tauri::command]
fn db_set_setting(key: String, val: String) {
    let _ = db().execute(
        "INSERT OR REPLACE INTO settings(key,value) VALUES(?1,?2)",
        params![key, val],
    );
}

#[tauri::command]
fn db_get_presets() -> Vec<TimerPreset> {
    let d = db();
    let mut stmt = d
        .prepare("SELECT id,name,secs FROM timer_presets ORDER BY id")
        .unwrap();
    stmt.query_map([], |r| {
        Ok(TimerPreset {
            id: r.get(0)?,
            name: r.get(1)?,
            secs: r.get(2)?,
        })
    })
    .unwrap()
    .filter_map(|r| r.ok())
    .collect()
}

#[tauri::command]
fn db_save_preset(name: String, secs: i64) -> TimerPreset {
    let d = db();
    d.execute(
        "INSERT INTO timer_presets(name,secs) VALUES(?1,?2)",
        params![name, secs],
    )
    .unwrap();
    let id = d.last_insert_rowid();
    TimerPreset { id, name, secs }
}

#[tauri::command]
fn db_delete_preset(id: i64) {
    let _ = db().execute("DELETE FROM timer_presets WHERE id=?1", params![id]);
}

// â”€â”€ Fichier musique â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#[tauri::command]
async fn pick_music_file(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter(
            "Audio",
            &["mp3", "wav", "ogg", "flac", "aac", "m4a", "opus", "wma"],
        )
        .pick_file(move |file| {
            let _ = tx.send(file);
        });
    rx.recv().ok()?.map(|path| path.to_string())
}

// â”€â”€ Dossier TÃ©lÃ©chargements (sans dÃ©pendance externe) â”€â”€â”€â”€â”€â”€â”€â”€â”€
fn downloads_dir() -> PathBuf {
    // Windows : USERPROFILE\Downloads, fallback HOME\Downloads, fallback .
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(|home| PathBuf::from(home).join("Downloads"))
        .unwrap_or_else(|_| PathBuf::from("."))
}

// â”€â”€ TÃ©lÃ©chargement MAJ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
static DOWNLOAD_PATH: OnceCell<Mutex<Option<PathBuf>>> = OnceCell::new();

fn dl_path() -> std::sync::MutexGuard<'static, Option<PathBuf>> {
    DOWNLOAD_PATH
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap()
}

#[tauri::command]
async fn download_update(url: String, version: String, app: AppHandle) -> Result<(), String> {
    let dest = downloads_dir().join(format!("Chrono-Setup-{}.exe", version));

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "chrono/1.5")
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let total = resp.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(&dest)
        .await
        .map_err(|error| error.to_string())?;
    let mut received: u64 = 0;

    use tokio::io::AsyncWriteExt;

    let mut stream = resp;
    while let Some(chunk) = stream.chunk().await.map_err(|error| error.to_string())? {
        file.write_all(&chunk)
            .await
            .map_err(|error| error.to_string())?;
        received += chunk.len() as u64;
        let percent = received
            .checked_mul(100)
            .and_then(|value| value.checked_div(total))
            .unwrap_or(0);
        let _ = app.emit(
            "update-progress",
            serde_json::json!({
                "percent": percent,
                "received": received,
                "total": total,
            }),
        );
    }
    file.flush().await.map_err(|error| error.to_string())?;

    *dl_path() = Some(dest);
    let _ = app.emit(
        "update-progress",
        serde_json::json!({
            "percent": 100,
            "status": "done",
        }),
    );
    Ok(())
}

#[tauri::command]
fn launch_installer() {
    if let Some(path) = dl_path().clone() {
        let _ = std::process::Command::new(&path).spawn();
        std::thread::sleep(std::time::Duration::from_millis(1500));
        std::process::exit(0);
    }
}

#[tauri::command]
fn cancel_download() {
    if let Some(path) = dl_path().clone() {
        let _ = std::fs::remove_file(path);
    }
    *dl_path() = None;
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn get_app_platform() -> String {
    std::env::consts::OS.to_string()
}

// â”€â”€ Helper : nom du moniteur en &str â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
fn monitor_name(monitor: &tauri::Monitor) -> &str {
    monitor.name().map(|name| name.as_str()).unwrap_or("")
}

// â”€â”€ Ã‰crans secondaires â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#[tauri::command]
fn get_displays(app: AppHandle) -> serde_json::Value {
    let monitors = app.available_monitors().unwrap_or_default();
    let primary = app.primary_monitor().ok().flatten();
    let primary_name = primary
        .as_ref()
        .map(|monitor| monitor_name(monitor).to_owned());

    let list: Vec<_> = monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let name = monitor_name(monitor);
            let is_primary = primary_name.as_deref() == Some(name);
            serde_json::json!({
                "index": index,
                "isPrimary": is_primary,
                "label": format!(
                    "Ã‰cran {}{}",
                    index + 1,
                    if is_primary { " (principal)" } else { "" }
                ),
                "bounds": {
                    "x": monitor.position().x,
                    "y": monitor.position().y,
                    "width": monitor.size().width,
                    "height": monitor.size().height,
                }
            })
        })
        .collect();

    serde_json::json!(list)
}

#[tauri::command]
fn move_to_second_screen(app: AppHandle) -> serde_json::Value {
    let monitors = app.available_monitors().unwrap_or_default();
    let primary = app.primary_monitor().ok().flatten();
    let primary_name = primary
        .as_ref()
        .map(|monitor| monitor_name(monitor).to_owned());

    let secondary = monitors
        .iter()
        .find(|monitor| primary_name.as_deref() != Some(monitor_name(monitor)));

    if let Some(monitor) = secondary {
        let position = monitor.position();
        let size = monitor.size();
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_position(tauri::PhysicalPosition::new(position.x, position.y));
            let _ = window.set_size(tauri::PhysicalSize::new(size.width, size.height));
            let _ = window.set_fullscreen(true);
        }
        return serde_json::json!({ "ok": true });
    }

    serde_json::json!({
        "ok": false,
        "reason": "single_screen",
    })
}

#[tauri::command]
fn restore_primary_screen(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_fullscreen(false);
        let _ = window.set_size(tauri::LogicalSize::new(1280.0_f64, 860.0_f64));
        let _ = window.center();
    }
}

// â”€â”€ Journal de plantage (la version release n'a pas de console) â”€â”€
fn install_crash_logger() {
    std::panic::set_hook(Box::new(|info| {
        use std::io::Write;

        let base = std::env::var("LOCALAPPDATA")
            .or_else(|_| std::env::var("HOME"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));
        let dir = base.join("com.chrono.app");
        let _ = std::fs::create_dir_all(&dir);
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir.join("crash.log"))
        {
            let _ = writeln!(file, "{}", info);
        }
    }));
}

// â”€â”€ Plein Ã©cran (bouton + F11) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#[tauri::command]
fn toggle_fullscreen(app: AppHandle) -> serde_json::Value {
    if let Some(window) = app.get_webview_window("main") {
        let is_fullscreen = window.is_fullscreen().unwrap_or(false);
        let _ = window.set_fullscreen(!is_fullscreen);
        return serde_json::json!({ "fullscreen": !is_fullscreen });
    }

    serde_json::json!({ "fullscreen": false })
}

// â”€â”€ Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_crash_logger();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            init_db(app.handle());
            // Force l'affichage et le focus de la fenÃªtre principale
            if let Some(window) = app.get_webview_window("main") {
                window.show().unwrap_or_default();
                window.set_focus().unwrap_or_default();
                window.center().unwrap_or_default();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_get_setting,
            db_set_setting,
            db_get_presets,
            db_save_preset,
            db_delete_preset,
            pick_music_file,
            download_update,
            launch_installer,
            cancel_download,
            get_app_version,
            get_app_platform,
            get_displays,
            move_to_second_screen,
            restore_primary_screen,
            toggle_fullscreen,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur Tauri");
}
