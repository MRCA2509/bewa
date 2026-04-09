# Bewa Logistics - Web GUI Documentation

## 🌐 Web Application

Aplikasi web berbasis React + Flask untuk upload file Excel dan menampilkan report data shipments.

---

## 🚀 Quick Start

### 1. Pastikan MySQL Running

```bash
# Di project root
start_mysql.bat

# Atau gunakan quick start
start.bat
```

### 2. Install Dependencies (First Time Only)

```bash
# Di folder web/
install.bat
```

Atau manual:
```bash
pip install flask flask-cors
cd web/frontend
npm install
```

### 3. Run Web Application

**Otomatis (Recommended):**
```bash
# Di project root
start.bat

# Atau di folder web/
run_web.bat
```

Browser akan terbuka otomatis di **http://localhost:5173**

**Manual:**
```bash
# Terminal 1 - Backend
cd web
python server.py

# Terminal 2 - Frontend  
cd web/frontend
npm run dev
```

---

## 📡 Endpoints

### Backend API (Port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Database statistics |
| GET | `/api/report/database` | Full database records |
| GET | `/api/report/summary` | Summary report with aggregations |
| GET | `/api/tracking/lookup?waybill=X` | Lookup waybill tracking |
| POST | `/api/actions/merge` | Trigger merge process |
| GET | `/api/actions/status` | Get merge process status |
| POST | `/api/upload` | Upload Excel file |

### Frontend UI (Port 5173)

- **Development:** http://localhost:5173
- **Production:** http://localhost:5000 (served by Flask)

---

## 🎨 Features

### Dashboard
- **Real-time Statistics:** Total records, active/history shipments, destinations
- **Upload Section:** Drag & drop Excel files (Monitor Sampai & Status Terupdate)
- **Merge Process:** Run merge dengan progress indicator
- **Tracking Lookup:** Cari waybill secara real-time
- **Charts:** Visualisasi data by destination & scan types

### Reports
- **Database Records:** View all active & history shipments
- **Filterable Tables:** Sortable, searchable data grids
- **Export Ready:** Data siap untuk export

### Design
- **Dark Theme:** Glassmorphism design (mirip lico-bot)
- **Responsive:** Mobile-friendly layout
- **Animations:** Smooth transitions & loading states
- **Real-time Updates:** Auto-refresh setiap 30 detik

---

## 📁 Project Structure

```
bewa/web/
├── server.py              # Flask backend API
├── install.bat            # Install dependencies script
├── run_web.bat            # Run application script
├── frontend/
│   ├── package.json       # Node.js dependencies
│   ├── vite.config.js     # Vite configuration
│   ├── index.html         # HTML template
│   ├── public/
│   │   └── vite.svg       # Favicon
│   └── src/
│       ├── main.jsx       # React entry point
│       ├── App.jsx        # Main dashboard component
│       └── index.css      # Global styles
```

---

## 💻 Usage Guide

### Upload Files

1. Buka dashboard
2. Klik "Choose File" di section **Monitor Sampai** atau **Status Terupdate**
3. Pilih file Excel yang sesuai
4. Merge process akan otomatis berjalan setelah upload

### Run Merge Manual

1. Klik tombol **"Run Merge Process"** di Dashboard
2. Tunggu progress bar selesai
3. Stats akan auto-refresh

### Track Waybill

1. Masukkan nomor waybill di search box
2. Tekan Enter atau klik **Search**
3. Lihat hasil tracking

### View Reports

1. Klik menu **Reports** di sidebar
2. Klik **Refresh** untuk load data terbaru
3. Scroll untuk lihat semua records

---

## 🎨 Design Tokens

```css
--bg-dark: #020617         /* Background utama */
--glass-bg: rgba(15, 23, 42, 0.7)  /* Glass effect */
--primary: #3b82f6         /* Blue - actions */
--success: #10b981         /* Green - success */
--warning: #f59e0b         /* Orange - warning */
--danger: #ef4444          /* Red - error */
```

---

## 🔧 Configuration

Edit `web/server.py` untuk mengubah konfigurasi:

```python
# Port configuration
app.run(host='0.0.0.0', port=5000, debug=True)

# Database connection (dari config/database.py)
BEWA_DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': '',
    'database': 'bewa_logistics',
}
```

---

## 🐛 Troubleshooting

### Backend tidak bisa start
```bash
# Cek port 5000 tidak digunakan
netstat -ano | findstr :5000

# Kill process jika ada
taskkill /F /PID <PID>
```

### Frontend tidak bisa connect ke backend
```bash
# Pastikan backend running di port 5000
curl http://localhost:5000/api/health

# Cek CORS enabled di server.py
```

### Database connection failed
```bash
# Pastikan MySQL running
sc query MySQL80

# Test koneksi
C:\Users\User\scoop\apps\mysql\current\bin\mysql.exe -u root bewa_logistics
```

---

## 📊 API Response Examples

### GET /api/stats
```json
{
  "success": true,
  "stats": {
    "active_shipments": 0,
    "history_shipments": 447,
    "total_records": 447,
    "unique_destinations": 5,
    "unique_scan_types": 6,
    "unique_stations": 118,
    "recent_activity": [...]
  }
}
```

### POST /api/actions/merge
```json
{
  "success": true,
  "message": "Merge process started"
}
```

### GET /api/tracking/lookup?waybill=1352425936
```json
{
  "success": true,
  "data": {
    "waybill_id": "1352425936",
    "tujuan": "MABA",
    "jenis_scan": "Scan TTD",
    "station_scan": "BULI",
    "archived_at": "2026-03-29 01:08:27"
  },
  "location": "history"
}
```

---

## 🚀 Production Build

```bash
# Build React frontend untuk production
cd web/frontend
npm run build

# Copy ke folder static Flask
# Flask akan serve dari web/frontend/dist
```

---

## 📝 License

Internal use only - Bewa Logistics

---

## 👨‍💻 Tech Stack

- **Backend:** Flask 3.x (Python)
- **Frontend:** React 19 + Vite 6
- **Charts:** Recharts 3.x
- **Icons:** Lucide React
- **Database:** MySQL 9.6
- **Styling:** CSS Custom Properties (Glassmorphism)
