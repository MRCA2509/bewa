// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod db;
mod utils;
mod server;

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
    let _conn = db::init_db().expect("Gagal inisialisasi SQLite native");

    // 2. Start Modular HTTP Server Background Process
    let (tx, rx) = tokio::sync::oneshot::channel();
    tokio::spawn(async move {
        server::run(tx).await;
    });

    // Wait for the server to bind and get the port
    let server_port = rx.await.expect("Failed to get server port");

    // 3. Launch Tauri Native Desktop Engine
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState { server_port })
        .invoke_handler(tauri::generate_handler![get_server_port])
        .run(tauri::generate_context!())
        .expect("Kegagalan kritis pada Tauri App");
}
