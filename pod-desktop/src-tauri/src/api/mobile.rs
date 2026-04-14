use axum::{
    extract::{Multipart, Json as AxumJson, Query},
    response::Json,
};
use serde_json::{json, Value};
use serde::Deserialize;
use crate::db;

#[derive(Deserialize)]
pub struct MobileLogin {
    code: String,
}

#[derive(Deserialize)]
pub struct MobileTasks {
    code: String,
}

pub async fn mobile_login(AxumJson(payload): AxumJson<MobileLogin>) -> Json<Value> {
    let conn = match db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    println!("[MOBILE] Login attempt with code: {}", payload.code);
    
    let mut stmt = match conn.prepare("SELECT sprinter_name FROM assignments WHERE sprinter_code = ? LIMIT 1") {
        Ok(s) => s,
        Err(e) => return Json(json!({"success": false, "message": format!("Query Error: {}", e)})),
    };
    let name: Result<String, _> = stmt.query_row([&payload.code], |row| row.get(0));
    
    if let Ok(sprinter_name) = name {
        Json(json!({ "success": true, "name": sprinter_name }))
    } else {
        Json(json!({ "success": false, "message": "Kode Sprinter tidak terdaftar di database!" }))
    }
}

pub async fn tasks(Query(params): Query<MobileTasks>) -> Json<Value> {
    let conn = match db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    match crate::db::queries::get_sprinter_tasks(&conn, &params.code) {
        Ok(tasks) => Json(json!({ "success": true, "data": tasks })),
        Err(_) => Json(json!({ "success": true, "data": [] }))
    }
}

pub async fn upload_pod(mut multipart: Multipart) -> Json<Value> {
    let conn = match db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    let mut waybill = String::new();
    let mut img1_path = String::new();
    let mut img2_path = String::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "waybill" {
            waybill = field.text().await.unwrap_or_default();
        } else if name == "image1" || name == "image2" {
            let data = match field.bytes().await {
                Ok(b) => b,
                Err(e) => {
                    eprintln!("[ERR] Failed to read multipart bytes: {}", e);
                    continue;
                }
            };
            let filename = format!("{}_{}_{}.jpg", waybill, name, uuid::Uuid::new_v4());
            let filepath = db::get_local_dir().join("uploads").join(&filename);
            if let Err(e) = tokio::fs::write(&filepath, data).await {
                eprintln!("[ERR] Failed to write image to disk: {}", e);
                continue;
            }
            if name == "image1" { img1_path = filename; } else { img2_path = filename; }
        }
    }
    
    if !waybill.is_empty() && !img1_path.is_empty() && !img2_path.is_empty() {
        let _ = crate::db::queries::update_pod_submission(&conn, &waybill, &img1_path, &img2_path);
        
        Json(json!({
            "success": true,
            "message": "POD Berhasil Terkirim!"
        }))
    } else {
        Json(json!({
            "success": false,
            "message": "Data upload tidak lengkap."
        }))
    }
}
