use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub mod models;
pub mod queries;

pub fn get_local_dir() -> PathBuf {
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn init_db() -> Result<Connection> {
    let data_dir = get_local_dir().join("data");
    let uploads_dir = get_local_dir().join("uploads");
    
    if !data_dir.exists() { std::fs::create_dir_all(&data_dir).unwrap(); }
    if !uploads_dir.exists() { std::fs::create_dir_all(&uploads_dir).unwrap(); }
    
    let db_path = data_dir.join("local.db");
    println!("[DB] Initializing database at: {:?}", db_path.canonicalize().unwrap_or(db_path.clone()));
    let conn = Connection::open(db_path)?;

    
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=NORMAL;
         PRAGMA temp_store=MEMORY;"
    )?;

    // Core table migrations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS assignments (
            waybill_id TEXT PRIMARY KEY,
            penerima TEXT,
            kecamatan_penerima TEXT,
            drop_point TEXT,
            sprinter_name TEXT,
            sprinter_code TEXT,
            pod_image1 TEXT,
            pod_image2 TEXT,
            waktu_sampai DATETIME,
            station_scan TEXT,
            jenis_scan TEXT,
            waktu_scan DATETIME,
            status TEXT DEFAULT 'PENDING',
            rejection_reason TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        (),
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            mac_address TEXT DEFAULT NULL,
            activated_at DATETIME DEFAULT NULL
        );",
        (),
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        (),
    )?;

    Ok(conn)
}
