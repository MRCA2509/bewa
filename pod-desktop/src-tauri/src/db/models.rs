use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Waybill {
    pub waybill_id: String,
    pub penerima: Option<String>,
    pub kecamatan_penerima: Option<String>,
    pub drop_point: Option<String>,
    pub sprinter_name: Option<String>,
    pub sprinter_code: Option<String>,
    pub pod_image1: Option<String>,
    pub pod_image2: Option<String>,
    pub waktu_sampai: Option<String>,
    pub station_scan: Option<String>,
    pub jenis_scan: Option<String>,
    pub waktu_scan: Option<String>,
    pub status: String,
    pub rejection_reason: Option<String>,
    pub updated_at: Option<String>,
    pub umur_paket: i32,
}


#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password: String,
    pub mac_address: Option<String>,
    pub activated_at: Option<String>,
}
