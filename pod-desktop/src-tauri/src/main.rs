// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod db;
mod utils;
mod server;

#[tokio::main]
async fn main() {
    // 1. Initialize SQLite Database
    let _conn = db::init_db().expect("Gagal inisialisasi SQLite native");

    // 2. Start Modular HTTP Server Background Process
    tokio::spawn(async {
        server::run().await;
    });

    // 3. Launch Tauri Native Desktop Engine
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("Kegagalan kritis pada Tauri App");
}
