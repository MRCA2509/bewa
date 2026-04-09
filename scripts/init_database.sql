-- Database Initialization Script for Bewa Logistics
-- Creates database and tables for shipment tracking with history separation

CREATE DATABASE IF NOT EXISTS bewa_logistics CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bewa_logistics;

-- ============================================
-- TABLE: shipments (Data Aktif)
-- ============================================
CREATE TABLE IF NOT EXISTS shipments (
    waybill_id VARCHAR(50) PRIMARY KEY,
    
    -- Data Monitor Sampai (Prioritas Utama)
    dp_outgoing VARCHAR(100),
    tujuan VARCHAR(100),
    jenis_layanan VARCHAR(50),
    sumber_order VARCHAR(50),
    berat_ditagih DECIMAL(10,2),
    drop_point VARCHAR(100),
    waktu_sampai DATETIME,
    lokasi_sebelumnya VARCHAR(255),
    discan_oleh VARCHAR(255),
    
    -- Data Pelengkap dari Status Terupdate
    no_order VARCHAR(50),
    diinput_oleh VARCHAR(100),
    waktu_input DATETIME,
    penerima VARCHAR(255),
    waktu_ttd DATETIME,
    waktu_regis_retur DATETIME,
    waktu_konfirmasi_retur DATETIME,
    agent_outgoing VARCHAR(100),
    tanggal_pengiriman DATETIME,
    agent_tujuan VARCHAR(100),
    provinsi_tujuan VARCHAR(100),
    kota_tujuan VARCHAR(100),
    nlc VARCHAR(50),
    dp_nlc VARCHAR(100),
    biaya_cod DECIMAL(15,2),
    total_dfod DECIMAL(15,2),
    tipe_pembayaran VARCHAR(50),
    status_asuransi VARCHAR(20),
    end_status VARCHAR(100),
    keterangan TEXT,
    station_scan VARCHAR(100),
    jenis_scan VARCHAR(100),
    waktu_scan DATETIME,
    discan_oleh_scan VARCHAR(255),
    sprinter VARCHAR(255),
    agent_scan VARCHAR(100),
    nomor_bagging VARCHAR(50),
    alasan_masalah TEXT,
    lokasi_berikutnya VARCHAR(255),
    
    -- Data Pencarian Retur
    dp_register_retur VARCHAR(100),
    waktu_tolak DATETIME,
    dp_tolak VARCHAR(100),
    alasan_penolakan TEXT,
    status_void VARCHAR(50),
    waktu_void DATETIME,
    dp_void_retur VARCHAR(100),
    
    -- Sync Columns
    last_status_sync_at DATETIME,
    
    -- System Columns
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_jenis_scan (jenis_scan),
    INDEX idx_station_scan (station_scan),
    INDEX idx_waktu_sampai (waktu_sampai),
    INDEX idx_tujuan (tujuan),
    INDEX idx_drop_point_waktu_sampai (drop_point, waktu_sampai),
    INDEX idx_waktu_regis_retur (waktu_regis_retur)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: shipments_histories (Data Histori)
-- ============================================
CREATE TABLE IF NOT EXISTS shipments_histories (
    waybill_id VARCHAR(50) PRIMARY KEY,
    
    -- Data Monitor Sampai (Prioritas Utama)
    dp_outgoing VARCHAR(100),
    tujuan VARCHAR(100),
    jenis_layanan VARCHAR(50),
    sumber_order VARCHAR(50),
    berat_ditagih DECIMAL(10,2),
    drop_point VARCHAR(100),
    waktu_sampai DATETIME,
    lokasi_sebelumnya VARCHAR(255),
    discan_oleh VARCHAR(255),
    
    -- Data Pelengkap dari Status Terupdate
    no_order VARCHAR(50),
    diinput_oleh VARCHAR(100),
    waktu_input DATETIME,
    penerima VARCHAR(255),
    waktu_ttd DATETIME,
    waktu_regis_retur DATETIME,
    waktu_konfirmasi_retur DATETIME,
    agent_outgoing VARCHAR(100),
    tanggal_pengiriman DATETIME,
    agent_tujuan VARCHAR(100),
    provinsi_tujuan VARCHAR(100),
    kota_tujuan VARCHAR(100),
    nlc VARCHAR(50),
    dp_nlc VARCHAR(100),
    biaya_cod DECIMAL(15,2),
    total_dfod DECIMAL(15,2),
    tipe_pembayaran VARCHAR(50),
    status_asuransi VARCHAR(20),
    end_status VARCHAR(100),
    keterangan TEXT,
    station_scan VARCHAR(100),
    jenis_scan VARCHAR(100),
    waktu_scan DATETIME,
    discan_oleh_scan VARCHAR(255),
    sprinter VARCHAR(255),
    agent_scan VARCHAR(100),
    nomor_bagging VARCHAR(50),
    alasan_masalah TEXT,
    lokasi_berikutnya VARCHAR(255),
    
    -- Data Pencarian Retur
    dp_register_retur VARCHAR(100),
    waktu_tolak DATETIME,
    dp_tolak VARCHAR(100),
    alasan_penolakan TEXT,
    status_void VARCHAR(50),
    waktu_void DATETIME,
    dp_void_retur VARCHAR(100),
    
    -- Sync Columns
    last_status_sync_at DATETIME,
    
    -- History Tracking
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archive_reason VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_archived_at (archived_at),
    INDEX idx_jenis_scan (jenis_scan),
    INDEX idx_station_scan (station_scan),
    INDEX idx_waktu_sampai (waktu_sampai),
    INDEX idx_drop_point_waktu_sampai (drop_point, waktu_sampai),
    INDEX idx_drop_point_archived_at (drop_point, archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Summary View: Quick stats
-- ============================================
CREATE OR REPLACE VIEW shipment_stats AS
SELECT 
    'Active' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT tujuan) as unique_destinations,
    COUNT(DISTINCT jenis_scan) as unique_scan_types
FROM shipments
UNION ALL
SELECT 
    'History' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT tujuan) as unique_destinations,
    COUNT(DISTINCT jenis_scan) as unique_scan_types
FROM shipments_histories;
