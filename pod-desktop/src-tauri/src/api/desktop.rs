use axum::response::Json;
use serde_json::{json, Value};
use local_ip_address::local_ip;
use axum::extract::Query;
use std::collections::HashMap;
use axum::response::IntoResponse;
use std::io::{Write, Cursor, Read};

pub async fn config() -> Json<Value> {
    let mut ip_str = "localhost".to_string();
    if let Ok(ip) = local_ip() {
        ip_str = ip.to_string();
    }
    Json(json!({
        "success": true,
        "mode": "RUST_AXUM_MODULAR",
        "localIp": ip_str,
        "allowedDps": crate::constants::ALLOWED_DROP_POINTS
    }))
}

pub async fn health() -> Json<Value> {
    Json(json!({
        "success": true,
        "health": {
            "localDb": true
        }
    }))
}

pub async fn list_drop_points() -> Json<Value> {
    Json(json!({
        "success": true,
        "data": crate::constants::ALLOWED_DROP_POINTS
    }))
}

pub async fn stats(headers: axum::http::HeaderMap, Query(params): Query<HashMap<String, String>>) -> Json<Value> {
    let role = headers.get("x-user-role").and_then(|h| h.to_str().ok()).unwrap_or("Guest");
    let dp_from_header = headers.get("x-user-dp").and_then(|h| h.to_str().ok());
    
    if role == "Guest" {
        return Json(json!({ "success": false, "message": "Autentikasi diperlukan" }));
    }

    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    
    let mut dp_filter = params.get("dropPoint").filter(|s| !s.is_empty() && s.as_str() != "undefined" && s.as_str() != "null").map(|s| s.as_str());

    // Security Hardening: Force DP filter if role is DP_ADMIN
    if role == "DP_ADMIN" {
        if let Some(dp) = dp_from_header {
            dp_filter = Some(dp);
        }
    }
    
    let total = crate::db::queries::count_total(&conn, dp_filter).map_err(|e| eprintln!("[ERR] count_total: {}", e)).unwrap_or(0);
    let pending = crate::db::queries::count_status(&conn, "PENDING", dp_filter).map_err(|e| println!("[ERR] count_status: {}", e)).unwrap_or(0);
    let validated = crate::db::queries::count_status(&conn, "VALIDATED", dp_filter).map_err(|e| println!("[ERR] count_status: {}", e)).unwrap_or(0);
    let rejected = crate::db::queries::count_status(&conn, "REJECTED", dp_filter).map_err(|e| println!("[ERR] count_status: {}", e)).unwrap_or(0);
    
    let sprinters = crate::db::queries::get_sprinter_stats(&conn, dp_filter).map_err(|e| println!("[ERR] get_sprinter_stats: {}", e)).unwrap_or_default();
    let completed_tasks = crate::db::queries::get_review_tasks(&conn, "COMPLETED", dp_filter).map_err(|e| println!("[ERR] get_review_tasks COMPLETED: {}", e)).unwrap_or_default();
    let validated_tasks = crate::db::queries::get_review_tasks(&conn, "VALIDATED", dp_filter).map_err(|e| println!("[ERR] get_review_tasks VALIDATED: {}", e)).unwrap_or_default();
    
    Json(json!({
        "success": true,
        "stats": {
            "total": total,
            "pending": pending,
            "completed": validated,
            "rejected": rejected
        },
        "sprinters": sprinters,
        "completed_tasks": completed_tasks,
        "validated_tasks": validated_tasks
    }))
}

pub async fn system_logs() -> Json<Value> {
    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    let logs = match crate::db::queries::get_logs(&conn) {
        Ok(l) => l,
        Err(e) => return Json(json!({"success": false, "message": format!("Query Error: {}", e)})),
    };
    Json(json!({ "success": true, "logs": logs }))
}

pub async fn outstanding(headers: axum::http::HeaderMap, Query(params): Query<HashMap<String, String>>) -> Json<Value> {
    let role = headers.get("x-user-role").and_then(|h| h.to_str().ok()).unwrap_or("Guest");
    let dp_from_header = headers.get("x-user-dp").and_then(|h| h.to_str().ok());

    if role == "Guest" {
        return Json(json!({ "success": false, "message": "Autentikasi diperlukan" }));
    }

    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    
    let mut dp_filter = params.get("dropPoint").filter(|s| !s.is_empty() && s.as_str() != "undefined" && s.as_str() != "null").map(|s| s.as_str());

    // Security Hardening: Force DP filter if role is DP_ADMIN
    if role == "DP_ADMIN" {
        if let Some(dp) = dp_from_header {
            dp_filter = Some(dp);
        }
    }
    let search = params.get("search").filter(|s| !s.is_empty() && s.as_str() != "undefined" && s.as_str() != "null").map(|s| s.as_str());
    let page: u32 = params.get("page").and_then(|p: &String| p.parse().ok()).unwrap_or(1);
    
    let (list, total) = crate::db::queries::get_outstanding(&conn, dp_filter, search, page)
        .unwrap_or((vec![], 0));
        
    let total_pages = (total as f32 / 20.0).ceil() as u32;

    Json(json!({
        "success": true,
        "data": list,
        "total": total,
        "totalPages": total_pages
    }))
}

pub async fn sync() -> Json<Value> {
    Json(json!({ "success": true, "message": "Sinkronisasi Lokal Berhasil" }))
}


#[derive(serde::Deserialize)]
pub struct ActionPayload {
    pub waybill_id: String,
    pub reason: Option<String>,
}


pub async fn validate(axum::Json(payload): axum::Json<ActionPayload>) -> Json<Value> {
    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    match crate::db::queries::update_status(&conn, &payload.waybill_id, "VALIDATED", None) {
        Ok(_) => {
            crate::db::queries::insert_log(&conn, &format!("Resi {} divalidasi oleh Admin.", payload.waybill_id));
            Json(json!({"success": true}))
        },
        Err(e) => {
            eprintln!("[ERR] Validate failed for {}: {}", payload.waybill_id, e);
            Json(json!({"success": false, "message": e.to_string()}))
        }
    }
}

pub async fn reject(axum::Json(payload): axum::Json<ActionPayload>) -> Json<Value> {
    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    let reason = payload.reason.clone().unwrap_or_else(|| "Tanpa alasan".to_string());
    match crate::db::queries::update_status(&conn, &payload.waybill_id, "REJECTED", Some(&reason)) {
        Ok(_) => {
            crate::db::queries::insert_log(&conn, &format!("Resi {} direject. Alasan: {}", payload.waybill_id, reason));
            Json(json!({"success": true}))
        },
        Err(e) => {
            eprintln!("[ERR] Reject failed for {}: {}", payload.waybill_id, e);
            Json(json!({"success": false, "message": e.to_string()}))
        }
    }
}


pub async fn login(axum::Json(payload): axum::Json<Value>) -> Json<Value> {
    let username = payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
    let password = payload.get("password").and_then(|v| v.as_str()).unwrap_or("");
    
    // Whitelist Drop Points check from global constants
    let allowed_dps = crate::constants::ALLOWED_DROP_POINTS;
    
    if username == "admin" && (password == "admin123" || password == "123") {
        if let Ok(conn) = crate::db::init_db() {
            crate::db::queries::insert_log(&conn, "Admin Pusat berhasil login.");
        }
        return Json(json!({
            "success": true,
            "user": { "role": "Master", "name": "Admin Pusat", "drop_point": null }
        }));
    }
    
    if username == "buli" && password == "buli01" {
        if let Ok(conn) = crate::db::init_db() {
            crate::db::queries::insert_log(&conn, "Admin BULI berhasil login.");
        }
        return Json(json!({
            "success": true,
            "user": { "role": "DP_ADMIN", "name": "Admin Buli", "drop_point": "BULI" }
        }));
    }
    
    // Generic DP account logic for future
    for dp in allowed_dps {
        if username == dp.to_lowercase() && password == format!("{}01", dp.to_lowercase()) {
             if let Ok(conn) = crate::db::init_db() {
                 crate::db::queries::insert_log(&conn, &format!("Admin {} berhasil login.", dp));
             }
             return Json(json!({
                "success": true,
                "user": { "role": "DP_ADMIN", "name": format!("Admin {}", dp), "drop_point": dp }
            }));
        }
    }

    Json(json!({
        "success": false,
        "message": "Username atau Password salah!"
    }))
}

pub async fn reset_data(headers: axum::http::HeaderMap) -> Json<Value> {
    let role = headers.get("x-user-role").and_then(|h| h.to_str().ok()).unwrap_or("Guest");
    let dp_filter = headers.get("x-user-dp").and_then(|h| h.to_str().ok());
    
    if role == "Guest" {
        return Json(json!({ "success": false, "message": "Akses ditolak" }));
    }

    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };

    let msg = if role == "Master" {
        let _ = crate::db::queries::reset_assignments(&conn, None);
        let _ = crate::db::queries::clear_logs(&conn);
        crate::db::queries::insert_log(&conn, "Admin Pusat melakukan Reset Total Database.");
        "Database Total Berhasil Dikosongkan."
    } else {
        match dp_filter {
            Some(dp) => {
                let _ = crate::db::queries::reset_assignments(&conn, Some(dp));
                crate::db::queries::insert_log(&conn, &format!("Admin {} melakukan Reset Data wilayah {}.", role, dp));
                "Data Wilayah Berhasil Dikosongkan."
            },
            None => "Gagal: Data wilayah tidak ditemukan."
        }
    };

    Json(json!({ "success": true, "message": msg }))
}



use calamine::{Reader, Xlsx, open_workbook_from_rs};
use axum_extra::extract::Multipart;
use rust_xlsxwriter::{Workbook, Format, Color};

pub async fn export_outstanding(headers: axum::http::HeaderMap) -> impl axum::response::IntoResponse {
    let role = headers.get("x-user-role").and_then(|h| h.to_str().ok()).unwrap_or("Master");
    let dp_from_header = headers.get("x-user-dp").and_then(|h| h.to_str().ok());

    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("DB Error: {}", e)).into_response(),
    };
    
    let waybills = if role == "DP_ADMIN" && dp_from_header.is_some() {
        crate::db::queries::get_all_outstanding(&conn).unwrap_or(vec![])
            .into_iter()
            .filter(|w| w.drop_point.as_deref() == dp_from_header)
            .collect()
    } else {
        crate::db::queries::get_all_outstanding(&conn).unwrap_or(vec![])
    };

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    // Headers
    let _ = worksheet.write(0, 0, "Waybill ID");
    let _ = worksheet.write(0, 1, "Penerima");
    let _ = worksheet.write(0, 2, "Drop Point");
    let _ = worksheet.write(0, 3, "Status");
    let _ = worksheet.write(0, 4, "Aging");

    for (i, w) in waybills.iter().enumerate() {
        let row = (i + 1) as u32;
        let _ = worksheet.write(row, 0, &w.waybill_id);
        let _ = worksheet.write(row, 1, w.penerima.as_deref().unwrap_or(""));
        let _ = worksheet.write(row, 2, w.drop_point.as_deref().unwrap_or(""));
        let _ = worksheet.write(row, 3, &w.status);
        let _ = worksheet.write(row, 4, format!("{} Hari", w.umur_paket));
    }

    let buf = match workbook.save_to_buffer() {
        Ok(b) => b,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Excel Error: {}", e)).into_response(),
    };
    
    (
        [
            (axum::http::header::CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=\"Outstanding_POD.xlsx\""),
        ],
        buf,
    ).into_response()
}

pub async fn export_validated(headers: axum::http::HeaderMap) -> impl axum::response::IntoResponse {
    let role = headers.get("x-user-role").and_then(|h| h.to_str().ok()).unwrap_or("Guest");
    let dp_from_header = headers.get("x-user-dp").and_then(|h| h.to_str().ok());

    if role == "Guest" {
        return ([(axum::http::header::CONTENT_TYPE, "text/plain")], "Unauthorized").into_response();
    }

    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("DB Error: {}", e)).into_response(),
    };
    
    // FIXED: Parameterized query to prevent SQL injection
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    let query = if role == "DP_ADMIN" && dp_from_header.is_some() {
        params.push(Box::new(dp_from_header.unwrap().to_string()));
        "SELECT waybill_id, sprinter_name, pod_image1, pod_image2 FROM assignments WHERE status = 'VALIDATED' AND drop_point = ?1 ORDER BY updated_at DESC"
    } else {
        "SELECT waybill_id, sprinter_name, pod_image1, pod_image2 FROM assignments WHERE status = 'VALIDATED' ORDER BY updated_at DESC"
    };

    let mut stmt = match conn.prepare(query) {
        Ok(s) => s,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Query Error: {}", e)).into_response(),
    };
    
    let rows = match stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            row.get::<_, Option<String>>(3)?.unwrap_or_default(),
        ))
    }) {
        Ok(r) => r,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Query Error: {}", e)).into_response(),
    };

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    // Headers
    let header_format = Format::new().set_bold().set_font_color(Color::Blue);
    let _ = worksheet.write_with_format(0, 0, "No. Waybill", &header_format);
    let _ = worksheet.write_with_format(0, 1, "Nama Sprinter", &header_format);
    let _ = worksheet.write_with_format(0, 2, "Path Foto POD", &header_format);
    let _ = worksheet.write_with_format(0, 3, "Path Foto Fisik", &header_format);

    for (i, row_data) in rows.enumerate() {
        if let Ok((wb, name, img1, img2)) = row_data {
            let row_idx = (i + 1) as u32;
            let _ = worksheet.write(row_idx, 0, &wb);
            let _ = worksheet.write(row_idx, 1, &name);
            let _ = worksheet.write(row_idx, 2, &img1);
            let _ = worksheet.write(row_idx, 3, &img2);
        }
    }

    let buf = match workbook.save_to_buffer() {
        Ok(b) => b,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Excel Error: {}", e)).into_response(),
    };
    (
        [
            (axum::http::header::CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=\"Laporan_POD_Validated.xlsx\""),
        ],
        buf,
    ).into_response()
}

pub async fn unified_export_validated(headers: axum::http::HeaderMap) -> impl axum::response::IntoResponse {
    let role = headers.get("x-user-role").and_then(|h| h.to_str().ok()).unwrap_or("Guest");
    let dp_from_header = headers.get("x-user-dp").and_then(|h| h.to_str().ok());

    if role == "Guest" {
        return ([(axum::http::header::CONTENT_TYPE, "text/plain")], "Unauthorized").into_response();
    }

    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("DB Error: {}", e)).into_response(),
    };
    
    // FIXED: Parameterized query to prevent SQL injection
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    let query = if role == "DP_ADMIN" && dp_from_header.is_some() {
        params.push(Box::new(dp_from_header.unwrap().to_string()));
        "SELECT waybill_id, sprinter_name, pod_image1, pod_image2 FROM assignments WHERE status = 'VALIDATED' AND drop_point = ?1 ORDER BY updated_at DESC"
    } else {
        "SELECT waybill_id, sprinter_name, pod_image1, pod_image2 FROM assignments WHERE status = 'VALIDATED' ORDER BY updated_at DESC"
    };

    let mut stmt = match conn.prepare(query) {
        Ok(s) => s,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Query Error: {}", e)).into_response(),
    };
    
    let rows: Vec<(String, String, String, String)> = match stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            row.get::<_, Option<String>>(3)?.unwrap_or_default(),
        ))
    }) {
        Ok(r) => r.filter_map(|r| r.ok()).collect(),
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Query Error: {}", e)).into_response(),
    };

    // 1. Create Excel
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    let header_format = Format::new().set_bold().set_font_color(Color::Blue);
    let _ = worksheet.write_with_format(0, 0, "No. Waybill", &header_format);
    let _ = worksheet.write_with_format(0, 1, "Nama Sprinter", &header_format);
    let _ = worksheet.write_with_format(0, 2, "Path Foto POD", &header_format);
    let _ = worksheet.write_with_format(0, 3, "Path Foto Fisik", &header_format);

    for (i, (wb, name, img1, img2)) in rows.iter().enumerate() {
        let row_idx = (i + 1) as u32;
        let _ = worksheet.write(row_idx, 0, wb);
        let _ = worksheet.write(row_idx, 1, name);
        let _ = worksheet.write(row_idx, 2, img1);
        let _ = worksheet.write(row_idx, 3, img2);
    }
    let excel_buf = match workbook.save_to_buffer() {
        Ok(b) => b,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Excel Error: {}", e)).into_response(),
    };

    // 2. Create ZIP
    let mut zip_buf = Vec::new();
    {
        let cursor = Cursor::new(&mut zip_buf);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        // Add Excel
        let _ = zip.start_file("Laporan_Validated.xlsx", options);
        let _ = zip.write_all(&excel_buf);

        // Add Images
        let uploads_dir = crate::db::get_local_dir().join("uploads");
        for (_, _, img1, img2) in rows {
            if !img1.is_empty() {
                let p = uploads_dir.join(&img1);
                if p.exists() {
                    if let Ok(mut f) = std::fs::File::open(p) {
                        let mut contents = Vec::new();
                        let _ = f.read_to_end(&mut contents);
                        let _ = zip.start_file(format!("POD/{}", img1), options);
                        let _ = zip.write_all(&contents);
                    }
                }
            }
            if !img2.is_empty() {
                let p = uploads_dir.join(&img2);
                if p.exists() {
                    if let Ok(mut f) = std::fs::File::open(p) {
                        let mut contents = Vec::new();
                        let _ = f.read_to_end(&mut contents);
                        let _ = zip.start_file(format!("FISIK/{}", img2), options);
                        let _ = zip.write_all(&contents);
                    }
                }
            }
        }
        let _ = zip.finish();
    }

    (
        [
            (axum::http::header::CONTENT_TYPE, "application/zip"),
            (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=\"Paket_Data_Validasi.zip\""),
        ],
        zip_buf,
    ).into_response()
}


pub async fn upload_excel(
    headers: axum::http::HeaderMap,
    mut multipart: Multipart
) -> Json<Value> {
    let username = headers.get("x-user-role").and_then(|h: &axum::http::HeaderValue| h.to_str().ok()).unwrap_or("Guest");
    let allowed_dp = headers.get("x-user-dp").and_then(|h: &axum::http::HeaderValue| h.to_str().ok());

    if username == "Guest" {
        return Json(json!({ "success": false, "message": "Akses ditolak" }));
    }

    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    let mut inserted = 0;
    let mut skipped = 0;
    
    let whitelist_dps = crate::constants::ALLOWED_DROP_POINTS;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" || name == "excel" {
            let data = match field.bytes().await {
                Ok(b) => b,
                Err(e) => {
                    println!("[ERR] Failed to read excel multipart bytes: {}", e);
                    continue;
                }
            };
            let cursor = Cursor::new(data.to_vec());
            let mut workbook: Xlsx<_> = match open_workbook_from_rs(cursor) {
                Ok(w) => w,
                Err(_) => return Json(json!({ "success": false, "message": "Gagal membuka file Excel. Pastikan file tidak diproteksi atau korup." }))
            };

            let range = match workbook.worksheet_range_at(0) {
                Some(Ok(r)) => r,
                _ => return Json(json!({ "success": false, "message": "Sheet 1 tidak ditemukan atau kosong." }))
            };
                let mut header_map = HashMap::new();
                for (i, row) in range.rows().enumerate() {
                    if i == 0 {
                        for (j, cell) in row.iter().enumerate() {
                            let h = cell.to_string().to_lowercase();
                            header_map.insert(h, j);
                        }
                        continue;
                    }

                    let val = |keys: &[&str]| -> String {
                        for k in keys {
                            if let Some(&idx) = header_map.get(&k.to_lowercase()) {
                                if let Some(c) = row.get(idx) { return c.to_string().trim().to_string(); }
                            }
                        }
                        String::new()
                    };

                    // Business Logic 1: Skip if Waktu Scan TTD exists
                    let ttd = val(&["waktu scan ttd", "ttd scan"]);
                    if !ttd.is_empty() { skipped += 1; continue; }

                    let waybill_id = crate::utils::normalization::normalize_waybill(&val(&["no. waybill", "no resi", "waybill"]));
                    if waybill_id.is_empty() { continue; }

                    let dp_raw = val(&["dp scan delivery", "drop point"]);
                    let dp_clean = crate::utils::normalization::normalize_drop_point(&dp_raw);

                    // Business Logic 2: Whitelist check
                    if !whitelist_dps.contains(&dp_clean.as_str()) { skipped += 1; continue; }

                    // Business Logic 3: Account restriction
                    if username != "Master" {
                        if let Some(limit_dp) = allowed_dp {
                            if dp_clean != limit_dp { skipped += 1; continue; }
                        }
                    }

                    // Business Logic 4: Force to index 34 (Column AI) as per user request
                    let recipient_raw = if row.len() > 34 {
                        row.get(34).map(|c| c.to_string()).unwrap_or_default()
                    } else {
                        String::new()
                    };
                    let recipient_clean = crate::utils::normalization::normalize_name(&recipient_raw);

                    let spr_name_raw = val(&["sprinter delivery", "nama sprinter", "派件员"]);
                    let spr_code_raw = val(&["kode sprinter delivery", "sprinter code", "kode sprinter", "staff code", "courier code", "delivery personnel code", "派件员编号"]);

                    
                    let spr_code = if !spr_code_raw.is_empty() {
                        spr_code_raw.to_uppercase()
                    } else {
                        crate::utils::normalization::extract_sprinter_code(&spr_name_raw)
                    };

                    if waybill_id.ends_with("001") || inserted % 50 == 0 {
                         println!("[DEBUG] Mapping Sprinter: Name='{}', RawCode='{}' -> Final='{}'", spr_name_raw, spr_code_raw, spr_code);
                    }

                    let w = crate::db::models::Waybill {
                        waybill_id,
                        penerima: Some(recipient_clean),
                        kecamatan_penerima: None,
                        drop_point: Some(dp_clean),
                        sprinter_name: Some(spr_name_raw),
                        sprinter_code: if spr_code.is_empty() { None } else { Some(spr_code.clone()) },
                        pod_image1: None,
                        pod_image2: None,
                        waktu_sampai: Some(val(&["waktu scan sampai", "scan sampai"])),
                        station_scan: None,
                        jenis_scan: None,
                        waktu_scan: None,
                        status: "PENDING".to_string(),
                        rejection_reason: None,
                        updated_at: None,
                        umur_paket: 1, // Start as day 1
                    };
                    
                    let resi_id = w.waybill_id.clone();
                    let dp_log = w.drop_point.clone().unwrap_or_default();
                    let code_log = spr_code.clone();

                    match crate::db::queries::insert_assignment(&conn, &w) {
                        Ok(_) => {
                            println!("[IMPORT] Saved: {} (DP: {}, Code: {})", resi_id, dp_log, code_log);
                            inserted += 1;
                        },
                        Err(e) => {
                            println!("[IMPORT] ERR saving {}: {}", resi_id, e);
                            skipped += 1;
                        }
                    }

                }
        }
    }
    println!("[IMPORT] Final Result - Inserted: {}, Skipped: {}", inserted, skipped);


    let msg = format!("Admin {} mengimpor data Excel: {} baru, {} dilewati.", username, inserted, skipped);
    crate::db::queries::insert_log(&conn, &msg);

    Json(json!({
         "success": true,
         "message": format!("Upload Selesai: {} data baru diimpor, {} data dilewati (Filter TTD/Wilayah).", inserted, skipped),
         "count": inserted
    }))
}

pub async fn download_archive() -> impl axum::response::IntoResponse {
    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("DB Error: {}", e)).into_response(),
    };
    let mut stmt = match conn.prepare("SELECT pod_image1, pod_image2 FROM assignments WHERE status = 'COMPLETED' OR status = 'VALIDATED'") {
        Ok(s) => s,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Query Error: {}", e)).into_response(),
    };
    
    let mut photo_names = Vec::new();
    let rows = match stmt.query_map([], |row| {
        let p1: Option<String> = row.get(0).ok();
        let p2: Option<String> = row.get(1).ok();
        Ok((p1, p2))
    }) {
        Ok(r) => r,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Query Error: {}", e)).into_response(),
    };

    for row in rows {
        if let Ok((p1, p2)) = row {
            if let Some(n) = p1 { if !n.is_empty() { photo_names.push(n); } }
            if let Some(n) = p2 { if !n.is_empty() { photo_names.push(n); } }
        }
    }

    let buf = crate::utils::file_handler::create_pod_zip(photo_names);

    (
        [
            (axum::http::header::CONTENT_TYPE, "application/zip"),
            (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=\"Arsip_POD_Bewa.zip\""),
        ],
        buf,
    ).into_response()
}

#[derive(serde::Deserialize)]
pub struct ImagePath {
    path: String
}

pub async fn view_image(Query(params): Query<ImagePath>) -> impl axum::response::IntoResponse {
    let uploads_dir = crate::db::get_local_dir().join("uploads");
    let safe_name = crate::utils::normalization::sanitize_filename(&params.path);
    let filepath = uploads_dir.join(safe_name);

    if filepath.exists() {
        if let Ok(bytes) = tokio::fs::read(filepath).await {
            return ([(axum::http::header::CONTENT_TYPE, "image/jpeg")], bytes).into_response();
        }
    }
    
    // Return empty correctly wrapped byte array for axum match
    let empty: Vec<u8> = vec![];
    ([(axum::http::header::CONTENT_TYPE, "image/jpeg")], empty).into_response()
}


#[derive(serde::Deserialize)]
pub struct SaveImagePayload {
    #[allow(dead_code)]
    pub waybill_id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "imageData")]
    pub image_data: String,
}

pub async fn save_image(axum::Json(payload): axum::Json<SaveImagePayload>) -> Json<Value> {
    use base64::{Engine as _, engine::general_purpose};
    
    let conn = match crate::db::init_db() {
        Ok(c) => c,
        Err(e) => return Json(json!({"success": false, "message": format!("DB Error: {}", e)})),
    };
    let uploads_dir = crate::db::get_local_dir().join("uploads");
    let safe_name = crate::utils::normalization::sanitize_filename(&payload.file_name);
    let filepath = uploads_dir.join(safe_name);

    // Clean base64 data (it might have "data:image/png;base64," prefix)
    let b64_clean = if let Some(pos) = payload.image_data.find(',') {
        &payload.image_data[pos+1..]
    } else {
        &payload.image_data
    };

    match general_purpose::STANDARD.decode(b64_clean) {
        Ok(bytes) => {
            if let Err(e) = std::fs::write(&filepath, bytes) {
                return Json(json!({ "success": false, "message": format!("File Error: {}", e) }));
            }
            
            crate::db::queries::insert_log(&conn, &format!("Admin mengedit gambar {} secara permanen.", payload.file_name));
            
            Json(json!({ "success": true, "message": "Gambar berhasil disimpan secara permanen." }))
        },
        Err(e) => Json(json!({ "success": false, "message": format!("Base64 Error: {}", e) }))
    }
}
