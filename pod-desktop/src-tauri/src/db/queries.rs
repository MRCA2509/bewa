use super::models::Waybill;
use rusqlite::{Connection, Result};

pub fn count_total(conn: &Connection, dp_filter: Option<&str>) -> Result<u32> {
    let mut query = String::from("SELECT COUNT(*) FROM assignments");
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    if let Some(dp) = dp_filter {
        query.push_str(" WHERE drop_point = ?");
        params.push(Box::new(dp.to_string()));
    }
    let mut stmt = conn.prepare(&query)?;
    let count: u32 = stmt.query_row(rusqlite::params_from_iter(params), |row| row.get(0))?;
    Ok(count)
}

pub fn get_outstanding(conn: &Connection, dp: Option<&str>, search: Option<&str>, page: u32) -> Result<(Vec<Waybill>, u32)> {
    let offset = (page.max(1) - 1) * 20;
    
    let mut where_clauses = vec!["status != 'COMPLETED' AND status != 'VALIDATED'".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(d) = dp {
        where_clauses.push("drop_point = ?".to_string());
        params.push(Box::new(d.to_string()));
    }
    if let Some(s) = search {
        where_clauses.push("(waybill_id LIKE ? OR penerima LIKE ?)".to_string());
        let s_pattern = format!("%{}%", s);
        params.push(Box::new(s_pattern.clone()));
        params.push(Box::new(s_pattern));
    }
    
    let where_str = where_clauses.join(" AND ");
    
    // Count total for pagination
    let count_query = format!("SELECT COUNT(*) FROM assignments WHERE {}", where_str);
    let mut count_stmt = conn.prepare(&count_query)?;
    let total: u32 = count_stmt.query_row(rusqlite::params_from_iter(params.iter()), |r| r.get(0))?;


    let query = format!(
        "SELECT *, CAST(JULIANDAY(DATE('now', 'localtime')) - JULIANDAY(DATE(waktu_sampai)) + 1 AS INTEGER) as umur_paket 
         FROM assignments 
         WHERE {} 
         ORDER BY waktu_sampai ASC LIMIT ? OFFSET ?", 
        where_str
    );

    let mut stmt = conn.prepare(&query)?;
    params.push(Box::new(20));
    params.push(Box::new(offset));

    let waybills = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        Ok(Waybill {
            waybill_id: row.get("waybill_id")?,
            penerima: row.get("penerima").unwrap_or(None),
            kecamatan_penerima: row.get("kecamatan_penerima").unwrap_or(None),
            drop_point: row.get("drop_point").unwrap_or(None),
            sprinter_name: row.get("sprinter_name").unwrap_or(None),
            sprinter_code: row.get("sprinter_code").unwrap_or(None),
            pod_image1: row.get("pod_image1").unwrap_or(None),
            pod_image2: row.get("pod_image2").unwrap_or(None),
            waktu_sampai: row.get("waktu_sampai").unwrap_or(None),
            station_scan: row.get("station_scan").unwrap_or(None),
            jenis_scan: row.get("jenis_scan").unwrap_or(None),
            waktu_scan: row.get("waktu_scan").unwrap_or(None),
            status: row.get("status")?,
            rejection_reason: row.get("rejection_reason").unwrap_or(None),
            updated_at: row.get("updated_at").unwrap_or(None),
            umur_paket: row.get("umur_paket").unwrap_or(0),
        })
    })?
    .filter_map(Result::ok)
    .collect();
    
    Ok((waybills, total))
}

pub fn get_all_outstanding(conn: &Connection) -> Result<Vec<Waybill>> {
    let mut stmt = conn.prepare(
        "SELECT *, CAST(JULIANDAY(DATE('now', 'localtime')) - JULIANDAY(DATE(waktu_sampai)) + 1 AS INTEGER) as umur_paket 
         FROM assignments 
         WHERE status != 'COMPLETED' AND status != 'VALIDATED'
         ORDER BY waktu_sampai ASC"
    )?;

    let waybills = stmt.query_map([], |row| {
        Ok(Waybill {
            waybill_id: row.get("waybill_id")?,
            penerima: row.get("penerima").unwrap_or(None),
            kecamatan_penerima: row.get("kecamatan_penerima").unwrap_or(None),
            drop_point: row.get("drop_point").unwrap_or(None),
            sprinter_name: row.get("sprinter_name").unwrap_or(None),
            sprinter_code: row.get("sprinter_code").unwrap_or(None),
            pod_image1: row.get("pod_image1").unwrap_or(None),
            pod_image2: row.get("pod_image2").unwrap_or(None),
            waktu_sampai: row.get("waktu_sampai").unwrap_or(None),
            station_scan: row.get("station_scan").unwrap_or(None),
            jenis_scan: row.get("jenis_scan").unwrap_or(None),
            waktu_scan: row.get("waktu_scan").unwrap_or(None),
            status: row.get("status")?,
            rejection_reason: row.get("rejection_reason").unwrap_or(None),
            updated_at: row.get("updated_at").unwrap_or(None),
            umur_paket: row.get("umur_paket").unwrap_or(0),
        })
    })?
    .filter_map(Result::ok)
    .collect();
    
    Ok(waybills)
}



pub fn insert_assignment(conn: &Connection, w: &Waybill) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO assignments (
            waybill_id, penerima, kecamatan_penerima, drop_point, 
            sprinter_name, sprinter_code, waktu_sampai, status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        (
            &w.waybill_id, &w.penerima, &w.kecamatan_penerima, &w.drop_point,
            &w.sprinter_name, &w.sprinter_code, &w.waktu_sampai, &w.status
        ),
    )?;
    Ok(())
}

pub fn update_status(conn: &Connection, waybill_id: &str, status: &str, reason: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE assignments SET status = ?1, rejection_reason = ?2, updated_at = CURRENT_TIMESTAMP WHERE waybill_id = ?3",
        (status, reason, waybill_id),
    )?;
    Ok(())
}

pub fn count_status(conn: &Connection, status: &str, dp_filter: Option<&str>) -> Result<u32> {
    let mut query = String::from("SELECT COUNT(*) FROM assignments WHERE status = ?");
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(status.to_string())];
    
    if let Some(dp) = dp_filter {
        query.push_str(" AND drop_point = ?");
        params.push(Box::new(dp.to_string()));
    }
    
    let mut stmt = conn.prepare(&query)?;
    let count: u32 = stmt.query_row(rusqlite::params_from_iter(params), |row| row.get(0))?;
    Ok(count)
}

#[derive(serde::Serialize, Debug)]
pub struct SprinterStat {
    pub sprinter_name: String,
    pub sprinter_code: String,
    pub total_tasks: i64,
    pub completed_tasks: i64,
}

pub fn get_sprinter_stats(conn: &Connection, dp_filter: Option<&str>) -> Result<Vec<SprinterStat>> {
    let mut query = String::from(
        "SELECT 
            COALESCE(sprinter_name, 'Unknown') as sprinter_name, 
            COALESCE(sprinter_code, '-') as sprinter_code, 
            COUNT(*) as total_tasks, 
            SUM(CASE WHEN status = 'COMPLETED' OR status = 'VALIDATED' THEN 1 ELSE 0 END) as completed_tasks 
         FROM assignments"
    );
    
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    if let Some(dp) = dp_filter {
        query.push_str(" WHERE drop_point = ?");
        params.push(Box::new(dp.to_string()));
    }
    
    query.push_str(" GROUP BY sprinter_name, sprinter_code ORDER BY total_tasks DESC");
    
    let mut stmt = conn.prepare(&query)?;
    let stats = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        Ok(SprinterStat {
            sprinter_name: row.get("sprinter_name")?,
            sprinter_code: row.get("sprinter_code")?,
            total_tasks: row.get("total_tasks")?,
            completed_tasks: row.get("completed_tasks")?,
        })
    })?
    .filter_map(Result::ok)
    .collect();
    
    Ok(stats)
}

pub fn get_review_tasks(conn: &Connection, status: &str, dp_filter: Option<&str>) -> Result<Vec<Waybill>> {
    let mut query = format!("SELECT *, 0 as umur_paket FROM assignments WHERE status = ?");
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(status.to_string())];
    
    if let Some(dp) = dp_filter {
        query.push_str(" AND drop_point = ?");
        params.push(Box::new(dp.to_string()));
    }
    query.push_str(" ORDER BY updated_at DESC LIMIT ?");
    params.push(Box::new(50));
    
    let mut stmt = conn.prepare(&query)?;
    let waybills = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        Ok(Waybill {
            waybill_id: row.get("waybill_id")?,
            penerima: row.get("penerima").unwrap_or(None),
            kecamatan_penerima: row.get("kecamatan_penerima").unwrap_or(None),
            drop_point: row.get("drop_point").unwrap_or(None),
            sprinter_name: row.get("sprinter_name").unwrap_or(None),
            sprinter_code: row.get("sprinter_code").unwrap_or(None),
            pod_image1: row.get("pod_image1").unwrap_or(None),
            pod_image2: row.get("pod_image2").unwrap_or(None),
            waktu_sampai: row.get("waktu_sampai").unwrap_or(None),
            station_scan: row.get("station_scan").unwrap_or(None),
            jenis_scan: row.get("jenis_scan").unwrap_or(None),
            waktu_scan: row.get("waktu_scan").unwrap_or(None),
            status: row.get("status")?,
            rejection_reason: row.get("rejection_reason").unwrap_or(None),
            updated_at: row.get("updated_at").unwrap_or(None),
            umur_paket: row.get("umur_paket").unwrap_or(0),
        })
    })?
    .filter_map(Result::ok)
    .collect();
    
    Ok(waybills)
}

#[derive(serde::Serialize)]
pub struct SystemLog {
    pub message: String,
    pub created_at: String,
}

pub fn insert_log(conn: &Connection, message: &str) {
    let _ = conn.execute("INSERT INTO system_logs (message) VALUES (?1)", (message,));
}

pub fn get_logs(conn: &Connection) -> Result<Vec<SystemLog>> {
    let mut stmt = conn.prepare("SELECT message, datetime(created_at, 'localtime') as created_at FROM system_logs ORDER BY id DESC LIMIT 50")?;
    let logs = stmt.query_map([], |row| {
        Ok(SystemLog {
            message: row.get(0)?,
            created_at: row.get(1)?,
        })
    })?
    .filter_map(Result::ok)
    .collect();
    Ok(logs)
}

// MOBILE API QUERIES
pub fn get_sprinter_tasks(conn: &Connection, code: &str) -> Result<Vec<Waybill>> {
    let mut stmt = conn.prepare(
        "SELECT *, CAST(JULIANDAY(DATE('now', 'localtime')) - JULIANDAY(DATE(waktu_sampai)) + 1 AS INTEGER) as umur_paket 
         FROM assignments 
         WHERE sprinter_code = ? AND status IN ('PENDING', 'REJECTED')
         ORDER BY waktu_sampai ASC"
    )?;
    
    let tasks = stmt.query_map([code], |row| {
        Ok(Waybill {
            waybill_id: row.get("waybill_id")?,
            penerima: row.get("penerima").unwrap_or(None),
            kecamatan_penerima: row.get("kecamatan_penerima").unwrap_or(None),
            drop_point: row.get("drop_point").unwrap_or(None),
            sprinter_name: row.get("sprinter_name").unwrap_or(None),
            sprinter_code: row.get("sprinter_code").unwrap_or(None),
            pod_image1: row.get("pod_image1").unwrap_or(None),
            pod_image2: row.get("pod_image2").unwrap_or(None),
            waktu_sampai: row.get("waktu_sampai").unwrap_or(None),
            station_scan: row.get("station_scan").unwrap_or(None),
            jenis_scan: row.get("jenis_scan").unwrap_or(None),
            waktu_scan: row.get("waktu_scan").unwrap_or(None),
            status: row.get("status")?,
            rejection_reason: row.get("rejection_reason").unwrap_or(None),
            updated_at: row.get("updated_at").unwrap_or(None),
            umur_paket: row.get("umur_paket").unwrap_or(0),
        })
    })?
    .filter_map(Result::ok)
    .collect();
    
    Ok(tasks)
}

pub fn update_pod_submission(conn: &Connection, wb: &str, img1: &str, img2: &str) -> Result<()> {
    conn.execute(
        "UPDATE assignments SET pod_image1 = ?1, pod_image2 = ?2, status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE waybill_id = ?3",
        (img1, img2, wb),
    )?;
    Ok(())
}

pub fn reset_assignments(conn: &Connection, dp_filter: Option<&str>) -> Result<()> {
    match dp_filter {
        Some(dp) => {
            conn.execute("DELETE FROM assignments WHERE drop_point = ?", [dp])?;
            println!("[DB] Resetting assignments for DP: {}", dp);
        },
        None => {
            conn.execute("DELETE FROM assignments", [])?;
            println!("[DB] Resetting ALL assignments");
        }
    }
    Ok(())
}

pub fn clear_logs(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM system_logs", [])?;
    println!("[DB] System logs cleared");
    Ok(())
}


