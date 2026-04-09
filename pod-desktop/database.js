const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use userData path for production packaging
const userDataPath = (app || require('electron').app).getPath('userData');
const dataDir = path.join(userDataPath, 'data');
const dbPath = path.join(dataDir, 'local.db');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize tables with corrected schema
db.exec(`
  CREATE TABLE IF NOT EXISTS assignments (
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
  );
`);

// Primitive Schema Migrations
try { db.exec("ALTER TABLE assignments ADD COLUMN waktu_sampai DATETIME;"); } catch (e) {}
try { db.exec("ALTER TABLE assignments ADD COLUMN drop_point TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE assignments ADD COLUMN rejection_reason TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE assignments ADD COLUMN station_scan TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE assignments ADD COLUMN jenis_scan TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE assignments ADD COLUMN waktu_scan DATETIME;"); } catch (e) {}

module.exports = db;
