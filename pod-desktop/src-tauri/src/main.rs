// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod db;
mod utils;
mod server;
mod constants;
mod assets;

use tauri::State;

struct AppState {
    server_port: u16,
}

#[tauri::command]
fn get_server_port(state: State<'_, AppState>) -> u16 {
    state.server_port
}

#[tokio::main]
async fn main() {
    // 1. Initialize SQLite Database
    if let Err(e) = db::init_db() {
        eprintln!("[CRITICAL] Gagal inisialisasi SQLite: {}", e);
        std::process::exit(1);
    }

    // 2. Start Modular HTTP Server Background Process
    let (tx, rx) = tokio::sync::oneshot::channel();
    tokio::spawn(async move {
        server::run(tx).await;
    });

    // Wait for the server to bind and get the port
    let server_port = match rx.await {
        Ok(port) => port,
        Err(e) => {
            eprintln!("[CRITICAL] Gagal mendapatkan server port: {}", e);
            std::process::exit(1);
        }
    };

    // 3. Launch Tauri Native Desktop Engine
    let build_res = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { server_port })
        .invoke_handler(tauri::generate_handler![get_server_port])
        .run(tauri::generate_context!());

    if let Err(e) = build_res {
        eprintln!("[CRITICAL] Kegagalan pada Tauri App: {}", e);
        std::process::exit(1);
    }
}
