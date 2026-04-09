# Bewa Logistics - Data Merge System

Sistem untuk menggabungkan data dari dua file Excel (**Monitor Sampai** dan **Status Terupdate**) ke dalam database MySQL dengan pemisahan otomatis antara data aktif dan histori.

---

## 📋 Fitur

- ✅ Merge data dari 2 file Excel berdasarkan **No. Waybill**
- ✅ Pemisahan otomatis ke tabel `shipments` (aktif) dan `shipments_histories` (histori)
- ✅ Aturan bisnis untuk penentuan histori (OR logic):
  1. `jenis_scan IN ('Scan TTD', 'Scan TTD Retur')`
  2. `station_scan NOT IN ('MABA', 'BULI', 'WASILE', 'SOFIFI', 'LABUHA', 'FALAJAWA2', 'SANANA', 'BOBONG')`
  3. `jenis_scan != 'Scan Pickup'`
- ✅ CLI interface yang mudah digunakan
- ✅ **Web GUI modern** dengan React + Flask (Design mirip lico-bot)
- ✅ Laporan merge yang detail
- ✅ Real-time dashboard dengan charts

---

## 📁 Struktur Project

```
bewa/
├── config/
│   ├── __init__.py
│   ├── database.py       # MySQL connection config
│   └── constants.py      # Business rules constants
├── models/
│   ├── __init__.py
│   └── shipment.py       # Shipment model dengan is_history() logic
├── services/
│   ├── __init__.py
│   └── merge_service.py  # Excel merge & database save logic
├── scripts/
│   └── init_database.sql # Database initialization script
├── main.py               # CLI entry point
├── requirements.txt      # Python dependencies
├── start_mysql.bat       # Script untuk start MySQL
├── verify_mysql.bat      # Script untuk verify MySQL installation
└── web/                  # Web GUI (React + Flask)
    ├── server.py         # Flask backend API
    ├── install.bat       # Install web dependencies
    ├── run_web.bat       # Run web application
    ├── README.md         # Web GUI documentation
    └── frontend/         # React frontend
        ├── src/
        │   ├── App.jsx   # Main dashboard component
        │   └── index.css # Global styles
        └── package.json
```

---

## 🚀 Instalasi & Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Install & Start MySQL

**Via Scoop (Recommended untuk Windows):**
```powershell
scoop install mysql
```

**Start MySQL:**
```bash
# Cara 1: Jalankan batch script
start_mysql.bat

# Cara 2: Manual
cd C:\Users\User\scoop\apps\mysql\current\bin
mysqld --standalone --console
```

### 3. Inisialisasi Database

```bash
python main.py --init-db
```

### 4. Run Web GUI (Recommended)

**Cara Termudah - Single Click:**
```bash
start.bat
```

**Atau Manual:**
```bash
cd web
run_web.bat
```

**Buka browser:** **http://localhost:5173** (akan terbuka otomatis)

### 5. Atau Gunakan CLI

```bash
# Merge data
python main.py

# Preview tanpa save
python main.py --dry-run

# Lihat statistik
python main.py --stats
```

---

## 🌐 Web GUI

### Features
- **Dashboard:** Upload Excel, run merge, track waybill, lihat charts
- **Reports:** View database records dengan filter
- **Real-time:** Auto-refresh stats setiap 30 detik
- **Design:** Dark theme dengan glassmorphism (mirip lico-bot)

### Run Web App

```bash
# Install (first time)
cd web
install.bat

# Run
run_web.bat
```

**URL:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

Lihat [web/README.md](web/README.md) untuk dokumentasi lengkap.

---

## 💻 Cara Penggunaan

### Run Full Merge Process

```bash
python main.py
```

### Preview Tanpa Save (Dry Run)

```bash
python main.py --dry-run
```

### Lihat Statistik Database

```bash
python main.py --stats
```

### Re-initialize Database

```bash
python main.py --init-db
```

---

## 📊 Database Schema

### Tabel: `shipments` (Data Aktif)

Menyimpan shipment yang masih dalam proses (belum memenuhi kriteria histori).

### Tabel: `shipments_histories` (Data Histori)

Menyimpan shipment yang sudah selesai atau keluar dari lokasi aktif.

**Kolom utama:**
- `waybill_id` - Primary Key
- `tujuan`, `jenis_layanan`, `dp_outgoing` - Data pengiriman
- `jenis_scan`, `station_scan`, `waktu_scan` - Tracking info
- `penerima`, `waktu_ttd` - Delivery confirmation
- `archived_at`, `archive_reason` - History tracking

---

## 📈 Hasil Merge (Data Saat Ini)

| Metric | Count |
|--------|-------|
| Total Records | 447 |
| Active Shipments | 1 |
| History Shipments | 446 |
| Unique Destinations | 5 |
| Unique Scan Types | 6 |

**Active Shipment:**
- JX7306962486 (MABA) - Scan Paket Bermasalah @ BULI

**History Breakdown:**
- Scan TTD: 261 records
- Scan TTD Retur: 182 records
- Other scans outside active locations: 3 records

---

## 🔧 Konfigurasi

Edit file `config/database.py` untuk mengubah koneksi MySQL:

```python
DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': '',  # Atau set via env: MYSQL_PASSWORD
    'database': 'bewa_logistics',
}
```

---

## 🛠️ Troubleshooting

### MySQL Tidak Bisa Start

```bash
# Cek apakah MySQL sudah running
tasklist | findstr mysqld

# Kill proses jika ada yang nyangkut
taskkill /F /IM mysqld.exe

# Start ulang
start_mysql.bat
```

### Error: Can't connect to MySQL server

1. Pastikan MySQL server running
2. Cek port 3306 tidak diblokir firewall
3. Verify credentials di `config/database.py`

### Error: Table doesn't exist

Jalankan ulang inisialisasi database:
```bash
python main.py --init-db
```

---

## 📝 Query Examples

**Lihat semua data aktif:**
```sql
SELECT * FROM shipments;
```

**Lihat histori berdasarkan tujuan:**
```sql
SELECT tujuan, COUNT(*) as count 
FROM shipments_histories 
GROUP BY tujuan 
ORDER BY count DESC;
```

**Lihat shipment yang di-arsip hari ini:**
```sql
SELECT waybill_id, tujuan, archived_at 
FROM shipments_histories 
WHERE DATE(archived_at) = CURDATE();
```

**Lihat statistik lengkap:**
```sql
SELECT * FROM shipment_stats;
```

---

## 📄 License

Internal use only - Bewa Logistics

---

## 👨‍💻 Author

Developed for Bewa Logistics data management system.
