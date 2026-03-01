use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::Emitter;
use tauri::Manager;

static LAST_CLOSE_ATTEMPT: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();

fn should_close_now() -> bool {
    let now = Instant::now();
    let lock = LAST_CLOSE_ATTEMPT.get_or_init(|| Mutex::new(None));
    let mut guard = match lock.lock() {
        Ok(value) => value,
        Err(_) => return false,
    };

    let close_window = match *guard {
        Some(last_attempt) => now.duration_since(last_attempt) <= Duration::from_secs(2),
        None => false,
    };

    *guard = Some(now);
    close_window
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if should_close_now() {
                    window.app_handle().exit(0);
                    return;
                }

                api.prevent_close();
                let _ = window.emit(
                    "app://close-prevented",
                    "Presiona cerrar nuevamente en 2 segundos para salir.",
                );
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
