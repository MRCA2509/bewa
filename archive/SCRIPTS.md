# Bewa Logistics - Scripts Documentation

## 📁 Batch Scripts Available

Project ini menyediakan beberapa script `.bat` untuk memudahkan operasional:

---

### 1. `start.bat` ⭐ (RECOMMENDED)

**Fungsi:** Quick start - cek & start MySQL, lalu jalankan web app

**Cara Pakai:**
```bash
start.bat
```

**Yang Dilakukan:**
1. ✅ Cek apakah MySQL sudah running
2. ✅ Start MySQL jika belum running
3. ✅ Jalankan web server (backend + frontend)
4. ✅ Buka browser otomatis ke http://localhost:5173

**Kapan Pakai:** Gunakan ini untuk penggunaan sehari-hari (paling mudah!)

---

### 2. `run.bat`

**Fungsi:** Jalankan web aplikasi (tanpa cek MySQL)

**Cara Pakai:**
```bash
run.bat
```

**Yang Dilakukan:**
1. ✅ Install Node.js dependencies jika belum ada
2. ✅ Start Flask backend (port 5000)
3. ✅ Start React frontend (port 5173)
4. ✅ Buka browser otomatis

**Kapan Pakai:** Jika MySQL sudah running dan ingin langsung jalankan web app

---

### 3. `start_mysql.bat`

**Fungsi:** Start MySQL server manual

**Cara Pakai:**
```bash
start_mysql.bat
```

**Yang Dilakukan:**
1. ✅ Start MySQL server di background
2. ✅ Test koneksi ke MySQL

**Kapan Pakai:** Jika ingin start MySQL saja tanpa jalankan web app

---

### 4. `verify_mysql.bat`

**Fungsi:** Verifikasi instalasi MySQL

**Cara Pakai:**
```bash
verify_mysql.bat
```

**Yang Dilakukan:**
1. ✅ Cek status service MySQL
2. ✅ Cek apakah mysql.exe ada di PATH
3. ✅ Cek installation paths

**Kapan Pakai:** Jika ada masalah koneksi MySQL

---

### 5. `web/install.bat`

**Fungsi:** Install dependencies untuk web GUI

**Cara Pakai:**
```bash
cd web
install.bat
```

**Yang Dilakukan:**
1. ✅ Install Python dependencies (flask, flask-cors)
2. ✅ Install Node.js dependencies (react, vite, recharts)

**Kapan Pakai:** First time setup atau jika ada missing dependencies

---

### 6. `web/run_web.bat`

**Fungsi:** Jalankan web aplikasi dari folder web/

**Cara Pakai:**
```bash
cd web
run_web.bat
```

**Yang Dilakukan:**
1. ✅ Start Flask backend
2. ✅ Start React frontend (dev mode)

**Kapan Pakai:** Alternatif untuk `run.bat` jika sedang di folder web/

---

## 🎯 Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Runs Script                      │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   ┌─────────┐        ┌─────────┐        ┌─────────┐
   │ start.bat│        │ run.bat │        │start_   │
   │         │        │         │        │mysql.bat│
   └────┬────┘        └────┬────┘        └────┬────┘
        │                  │                  │
        │ Check MySQL      │                  │
        ├─────────────────►│                  │
        │                  │                  │
        │ Start MySQL      │                  │
        ├─────────────────►│                  │
        │                  │                  │
        │ Run run.bat      │                  │
        ├─────────────────►│                  │
        │                  │                  │
        │                  │ Install deps?    │
        │                  ├─────────────────┐│
        │                  │                ││
        │                  │                ▼│
        │                  │         ┌──────┴─────┐
        │                  │         │install.bat │
        │                  │         └──────┬─────┘
        │                  │                │
        │                  │                ▼
        │                  │         Install Flask
        │                  │         Install Node
        │                  │                │
        │                  ▼                ▼
        │          ┌──────────────────────────┐
        │          │   Start Flask Backend    │
        │          │   (port 5000)            │
        │          └────────────┬─────────────┘
        │                       │
        │                       ▼
        │          ┌──────────────────────────┐
        │          │   Start React Frontend   │
        │          │   (port 5173)            │
        │          └────────────┬─────────────┘
        │                       │
        │                       ▼
        │          ┌──────────────────────────┐
        │          │   Open Browser           │
        │          │   http://localhost:5173  │
        │          └──────────────────────────┘
        │
        ▼
   Start MySQL
   (if needed)
```

---

## 📊 Comparison Table

| Script | Check MySQL | Start MySQL | Install Deps | Start Backend | Start Frontend | Open Browser |
|--------|-------------|-------------|--------------|---------------|----------------|--------------|
| `start.bat` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `run.bat` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `start_mysql.bat` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `verify_mysql.bat` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `web/install.bat` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `web/run_web.bat` | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

---

## 🔧 Troubleshooting Scripts

### MySQL Tidak Running

```bash
# 1. Verify instalasi
verify_mysql.bat

# 2. Start manual
start_mysql.bat

# 3. Quick start semua
start.bat
```

### Web App Error

```bash
# 1. Reinstall dependencies
cd web
install.bat

# 2. Run ulang
run.bat
```

### Port Sudah Dipakai

```bash
# Cek port 5000 (backend)
netstat -ano | findstr :5000

# Cek port 5173 (frontend)
netstat -ano | findstr :5173

# Kill process
taskkill /F /PID <PID>
```

---

## 💡 Tips

1. **Gunakan `start.bat`** untuk kemudahan - semua otomatis!
2. **Tunggu 5-10 detik** setelah start untuk MySQL fully ready
3. **Jangan tutup** window backend/frontend saat aplikasi running
4. **Ctrl+C** di setiap window untuk stop server
5. **Bookmark** http://localhost:5173 untuk akses cepat

---

## 📝 File Locations

```
C:\Users\User\Pictures\bewa\
├── start.bat              # ⭐ Quick start (MySQL + Web)
├── run.bat                # Run web app
├── start_mysql.bat        # Start MySQL only
├── verify_mysql.bat       # Verify MySQL
└── web/
    ├── install.bat        # Install web dependencies
    └── run_web.bat        # Run web from web/ folder
```

---

## 🚀 Quick Commands

```bash
# Full automatic start
start.bat

# Manual control
start_mysql.bat    # 1. Start MySQL
run.bat            # 2. Run web app

# Check status
verify_mysql.bat   # Verify MySQL installation

# Fix issues
cd web && install.bat   # Reinstall dependencies
```

---

**Last Updated:** 2026-03-29
**Version:** 1.0.0
