const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const multer = require('multer');
const fs = require('fs');
const archiver = require('archiver');
const axios = require('axios'); // We installed axios
const { app: electronApp } = require('electron');
const { exec } = require('child_process');
const db = require('./database');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Use userData path for writable directories in packaged app
const userDataPath = (electronApp || require('electron').app).getPath('userData');

const VPS_URL = process.env.VPS_URL || 'http://localhost:5000';
const BEWA_API_KEY = process.env.BEWA_API_KEY || 'bewa-internal-2026';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads dir exists in userData
const uploadsDir = path.join(userDataPath, 'uploads');
app.use('/uploads', express.static(uploadsDir));
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure logs dir exists in userData
const logsDir = path.join(userDataPath, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFilePath = path.join(logsDir, 'desktop.log');

function writeLog(msg, type = 'INFO') {
  try {
    const time = new Date().toISOString();
    const logLine = `[${time}] [${type}] ${msg}\n`;
    fs.appendFileSync(logFilePath, logLine);
    if (type === 'ERROR') console.error(logLine.trim());
    else console.log(logLine.trim());
  } catch (e) {
    console.error("Failed writing to log file:", e);
  }
}

writeLog('BEWA Desktop Server Engine initiated', 'SYSTEM');

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    // We will rename them later when we know the waybill
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function startServer(callback) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    callback(port, getLocalIpAddress());
  });
}

// API for UI to get configuration
app.get('/api/desktop/config', (req, res) => {
  res.json({ success: true, vpsUrl: VPS_URL, apiKey: BEWA_API_KEY });
});

// API for remote UI logging
app.post('/api/desktop/log', (req, res) => {
  const { message, type } = req.body;
  if (message) writeLog(`[UI_CLIENT] ${message}`, type ? type.toUpperCase() : 'UI_INFO');
  res.json({ success: true });
});

// API to check environment health
app.post('/api/desktop/run-sync-master', (req, res) => {
  const projectRoot = path.join(__dirname, '..');
  const batPath = path.join(projectRoot, 'deploy.bat');
  
  writeLog('Manual Master Sync triggered from Desktop UI', 'ACTION');
  
  if (process.platform === 'win32') {
    // Jalankan deploy.bat di window baru
    exec(`start "BEWA LOGISTICS - Master Sync" cmd /k "${batPath}"`, (error) => {
      if (error) {
        writeLog(`Failed to trigger sync: ${error.message}`, 'ERROR');
        return res.status(500).json({ success: false, message: error.message });
      }
      res.json({ success: true, message: 'Sync process started in new window' });
    });
  } else {
    res.status(400).json({ success: false, message: 'Feature only available on Windows local node' });
  }
});

// API to check environment health
app.get('/api/desktop/health', async (req, res) => {
  writeLog('Running environment health checks...', 'INFO');
  const health = { localDb: false, vps: false };
  
  try {
    // Check local DB
    db.prepare('SELECT 1').get();
    health.localDb = true;
  } catch(e) {
    writeLog(`Local DB Check Failed: ${e.message}`, 'ERROR');
  }

  try {
    // Check VPS
    await axios.get(`${VPS_URL}/api/health`, { timeout: 8000 });
    health.vps = true;
  } catch(e) {
    writeLog(`VPS Check Failed: [${VPS_URL}] ${e.message}`, 'ERROR');
  }

  writeLog(`Health Check Completed - DB: ${health.localDb ? 'OK' : 'FAIL'}, VPS: ${health.vps ? 'OK' : 'FAIL'}`, 'INFO');
  res.json({ success: true, health });
});

// API to proxy login to VPS
app.post('/api/desktop/proxy-login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const response = await axios.post(`${VPS_URL}/api/login`, { username, password });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.message || 'Gagal terhubung ke VPS BEWA' });
  }
});

// API to proxy DP list to VPS
app.post('/api/desktop/list-drop-points', async (req, res) => {
  const { token } = req.body;
  try {
    const response = await axios.get(`${VPS_URL}/api/sync/list-drop-points`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.message || 'Gagal mengambil daftar DP' });
  }
});

// API to sync tasks from VPS Cloud
app.post('/api/desktop/sync', async (req, res) => {
  const { dropPoint } = req.body;
  if (!dropPoint) {
    return res.status(400).json({ success: false, message: 'Harap lengkapi Drop Point' });
  }

  try {
    const url = `${VPS_URL}/api/sync/dp-assignments?drop_point=${encodeURIComponent(dropPoint)}`;
    const response = await axios.get(url, { headers: { 'X-API-Key': BEWA_API_KEY } });
    const data = response.data.data;

    // Insert to local database
    const insert = db.prepare(`
      INSERT INTO assignments (
        waybill_id, penerima, kecamatan_penerima, drop_point, waktu_sampai, 
        sprinter_name, sprinter_code, status, station_scan, jenis_scan, waktu_scan
      )
      VALUES (
        @waybill_id, @penerima, @tujuan, @drop_point, @waktu_sampai, 
        @sprinter_name, @sprinter_code, 'PENDING', @station_scan, @jenis_scan, @waktu_scan
      )
      ON CONFLICT(waybill_id) DO UPDATE SET 
        penerima=excluded.penerima,
        kecamatan_penerima=excluded.kecamatan_penerima,
        waktu_sampai=excluded.waktu_sampai,
        sprinter_name=excluded.sprinter_name,
        sprinter_code=excluded.sprinter_code,
        drop_point=excluded.drop_point,
        station_scan=excluded.station_scan,
        jenis_scan=excluded.jenis_scan,
        waktu_scan=excluded.waktu_scan
    `);

    const insertManyAndClean = db.transaction((rows) => {
      for (const row of rows) insert.run(row);

      const localPending = db.prepare("SELECT waybill_id FROM assignments WHERE drop_point = ? AND status = 'PENDING'").all(dropPoint);
      const remoteWaybills = new Set(rows.map(r => r.waybill_id));
      
      const toDelete = localPending.filter(local => !remoteWaybills.has(local.waybill_id));
      if (toDelete.length > 0) {
          const deleteStmt = db.prepare("DELETE FROM assignments WHERE waybill_id = ?");
          for (const item of toDelete) deleteStmt.run(item.waybill_id);
      }
    });

    insertManyAndClean(data);
    res.json({ success: true, count: data.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
});

// API for Desktop Dashboard Stats
app.get('/api/desktop/stats', (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as count FROM assignments").get().count;
    const pending = db.prepare("SELECT COUNT(*) as count FROM assignments WHERE status = 'PENDING'").get().count;
    const completed = db.prepare("SELECT COUNT(*) as count FROM assignments WHERE status = 'COMPLETED'").get().count;
    const rejected = db.prepare("SELECT COUNT(*) as count FROM assignments WHERE status = 'REJECTED'").get().count;
    
    const sprinters = db.prepare(`
      SELECT sprinter_code, sprinter_name, 
             COUNT(*) as total_tasks,
             SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks
      FROM assignments
      GROUP BY sprinter_code
    `).all();

    const completed_tasks = db.prepare("SELECT * FROM assignments WHERE status = 'COMPLETED' ORDER BY updated_at DESC").all();

    const aging_details = db.prepare(`
      SELECT waybill_id, sprinter_name, waktu_sampai, station_scan, jenis_scan, waktu_scan, status
      FROM assignments
      ORDER BY 
        CASE status 
          WHEN 'PENDING' THEN 1 
          WHEN 'REJECTED' THEN 2 
          ELSE 3 
        END ASC,
        waktu_sampai ASC
    `).all();

    res.json({ success: true, stats: { total, pending, completed, rejected }, sprinters, completed_tasks, aging_details });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// API to push completed statuses back to VPS Cloud
app.post('/api/desktop/sync-back', async (req, res) => {
  try {
    const completedRows = db.prepare("SELECT waybill_id FROM assignments WHERE status = 'COMPLETED'").all();
    const rejectedRows = db.prepare("SELECT waybill_id FROM assignments WHERE status = 'REJECTED'").all();
    
    const completed_waybills = completedRows.map(r => r.waybill_id);
    const rejected_waybills = rejectedRows.map(r => r.waybill_id);
    
    if (completed_waybills.length === 0 && rejected_waybills.length === 0) {
      return res.json({ success: true, message: 'Tidak ada data baru untuk disinkronisasi.', updated: 0 });
    }

    const url = `${VPS_URL}/api/actions/sync-pod-status`;
    const response = await axios.post(url, { 
      completed_waybills, 
      rejected_waybills 
    }, { 
      headers: { 'X-API-Key': BEWA_API_KEY, 'Content-Type': 'application/json' } 
    });

    if (response.data.success && rejected_waybills.length > 0) {
        // Reset ONLY the successfully synced rejected tasks back to pending
        const placeholders = rejected_waybills.map(() => '?').join(',');
        db.prepare(`UPDATE assignments SET status = 'PENDING' WHERE status = 'REJECTED' AND waybill_id IN (${placeholders})`).run(...rejected_waybills);
    }

    res.json({ success: true, message: response.data.message, updated: response.data.updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
});

// API for Admin Rejection
app.post('/api/desktop/reject', (req, res) => {
  const { waybill_id, reason } = req.body;
  if (!waybill_id || !reason) return res.status(400).json({ success: false, message: 'Waybill dan Alasan wajib diisi' });

  try {
    db.prepare("UPDATE assignments SET status = 'REJECTED', rejection_reason = ? WHERE waybill_id = ?").run(reason, waybill_id);
    res.json({ success: true, message: 'Berhasil me-reject resi' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// API to serve image with absolute path (needed for admin view)
app.get('/api/desktop/view-image', (req, res) => {
  const { path: imgPath } = req.query;
  if (!imgPath) return res.status(400).send('Path missing');
  if (fs.existsSync(imgPath)) {
    res.sendFile(imgPath);
  } else {
    res.status(404).send('File not found');
  }
});

// Download ZIP of all completed PODs
app.get('/api/desktop/download-zip', (req, res) => {
  const completed = db.prepare("SELECT waybill_id, pod_image1, pod_image2 FROM assignments WHERE status = 'COMPLETED'").all();
  
  res.attachment('BEWA_POD_Export.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') { console.warn(err); } else { throw err; }
  });
  archive.on('error', function(err) { throw err; });
  archive.pipe(res);

  completed.forEach(row => {
    // Combine POD image
    if (row.pod_image1 && fs.existsSync(row.pod_image1)) {
      archive.file(row.pod_image1, { name: `${row.waybill_id}.jpg` });
    }
    // Fisik image
    if (row.pod_image2 && fs.existsSync(row.pod_image2)) {
      archive.file(row.pod_image2, { name: `fisik_${row.waybill_id}.jpg` });
    }
  });

  archive.finalize();
});


// ============================================
// MOBILE SPRINTER APIs
// ============================================

app.post('/api/mobile/login', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Kode diperlukan' });
  
  // Just verify if code exists
  const exists = db.prepare("SELECT sprinter_name FROM assignments WHERE sprinter_code = ? LIMIT 1").get(code);
  if (exists) {
    res.json({ success: true, name: exists.sprinter_name });
  } else {
    res.status(404).json({ success: false, message: 'Kode tidak ditemukan. Hubungi koordinator.' });
  }
});

app.get('/api/mobile/tasks', (req, res) => {
  const { code } = req.query;
  try {
    const tasks = db.prepare("SELECT * FROM assignments WHERE sprinter_code = ? ORDER BY status ASC").all(code);
    res.json({ success: true, data: tasks });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/mobile/upload', upload.fields([{ name: 'image1', maxCount: 1 }, { name: 'image2', maxCount: 1 }]), (req, res) => {
  const { code, waybill } = req.body;
  
  // Safe check to prevent TypeError resulting in server crash
  if (!req.files || !req.files.image1 || !req.files.image2) {
    return res.status(400).json({ success: false, message: 'Perlu dua gambar (Gabungan POD & Paket Fisik)' });
  }

  try {
    const file1 = req.files.image1[0].path;
    const file2 = req.files.image2[0].path;

    db.prepare(`
      UPDATE assignments 
      SET pod_image1 = ?, pod_image2 = ?, status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
      WHERE waybill_id = ? AND sprinter_code = ?
    `).run(file1, file2, waybill, code);

    res.json({ success: true, message: 'Upload berhasil' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = { startServer };
