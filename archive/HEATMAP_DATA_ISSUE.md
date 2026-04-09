# 🔍 HEATMAP AUDIT - DATA ISSUE ANALYSIS

**Audit Date:** 2026-03-29  
**Issue:** Heatmap tidak menampilkan data dengan benar  
**Status:** ❌ DATA MASALAH - Excel Files Berbeda  

---

## 📊 MASALAH DITEMUKAN

### 1. Drop Point Kolom Hilang ❌

**Database State:**
```
Drop Point NOT NULL: 446/2,533 records (18%)
Drop Point NULL:     2,087 records (82%)
```

### 2. Waktu Sampai Tanggal Salah ❌

**Expected:** Hanya 1-2 Maret  
**Actual:** 1 Maret - 17 Maret (bermacam-macam)

---

## 🔍 ROOT CAUSE: 2 FILE EXCEL BERBEDA

### File #1 - OLD (Original)
```
Filename: Monitor Sampai(Refine)(Detail)668488520260328204423.xlsx
Rows:     447
Columns:  ['No. Waybill', 'DP Outgoing', 'Tujuan', 'Jenis Layanan', 
           'Sumber Order', 'Berat Ditagih', 'Drop Point', ✅ ADA!
           'Waktu Sampai', 'Lokasi Sebelumnya', 'Discan oleh']

Drop Point:   BULI (all 447 rows)
Waktu Sampai: 2026-03-01 (all rows)
```

### File #2 - NEW (Uploaded)
```
Filename: Monitor Sampai(Refine)(Detail)668488520260329005951.xlsx
Rows:     2,101
Columns:  ['No. Waybill', 'DP Outgoing', 'Tujuan', 'Jenis Layanan', 
           'Sumber Order', 'Berat Ditagih', 'Lokasi Selanjutnya', ❌ TIDAK ADA Drop Point!
           'Waktu Sampai', 'Waktu Kirim', 'DP Kirim']

Drop Point:   COLUMN MISSING!
Waktu Sampai: 2026-03-02 to 2026-03-17 (various dates)
```

---

## 📈 DATABASE STATE SAAT INI

### Waktu Sampai Distribution
```
DATE         COUNT    SOURCE
─────────────────────────────────
0001-01-01   42       Invalid date (data issue)
2026-03-01   446      From OLD Excel (BULI)
2026-03-02   28       From NEW Excel
2026-03-03   30       From NEW Excel
2026-03-04   797      From NEW Excel
2026-03-05   831      From NEW Excel
2026-03-06   344      From NEW Excel
2026-03-11   1        From NEW Excel
2026-03-17   14       From NEW Excel
─────────────────────────────────
TOTAL:       2,533
```

### Drop Point Distribution
```
DROP POINT    COUNT    SOURCE
─────────────────────────────────
BULI          446      From OLD Excel
NULL          2,087    From NEW Excel (column missing)
─────────────────────────────────
TOTAL:        2,533
```

---

## 🎯 HEATMAP IMPACT

### Heatmap Saat Ini (Broken)
```
┌─────────────┬─────────┬─────────┬─────────┬─────────┬───────┐
│ Drop Point  │ 03-01   │ 03-02   │ 03-03   │ ...     │ TOTAL │
├─────────────┼─────────┼─────────┼─────────┼─────────┼───────┤
│ BULI        │ 🔴 446  │   -     │   -     │ ...     │  446  │
│ Unknown     │   -     │   -     │   -     │ ...     │    0  │
└─────────────┴─────────┴─────────┴─────────┴─────────┴───────┘

❌ 2,087 records TIDAK TERLIHAT (Drop Point = NULL)
```

### Heatmap Yang Seharusnya (Jika Data Complete)
```
┌─────────────┬─────────┬─────────┬─────────┬─────────┬───────┐
│ Drop Point  │ 03-01   │ 03-02   │ 03-03   │ ...     │ TOTAL │
├─────────────┼─────────┼─────────┼─────────┼─────────┼───────┤
│ BULI        │ 🔴 446  │   -     │   -     │ ...     │  446  │
│ [DP Baru 1] │   -     │  🟡 50  │  🟢 20  │ ...     │  500  │
│ [DP Baru 2] │   -     │  🟢 30  │  🟡 80  │ ...     │  600  │
│ ...         │  ...    │  ...    │  ...    │ ...     │  ...  │
└─────────────┴─────────┴─────────┴─────────┴─────────┴───────┘

✅ Semua 2,533 records terlihat
```

---

## 🔧 SOLUSI

### Option 1: Fix Excel Template (RECOMMENDED) ⭐

**Action:** Tambahkan kolom "Drop Point" ke file Monitor Sampai yang baru

**Required Columns:**
```
['No. Waybill', 'DP Outgoing', 'Tujuan', 'Jenis Layanan', 
 'Sumber Order', 'Berat Ditagih', 'Drop Point', ✅ WAJIB ADA
 'Waktu Sampai', 'Lokasi Sebelumnya', 'Discan oleh']
```

**How To:**
1. Buka file Excel baru
2. Tambahkan kolom "Drop Point" setelah "Berat Ditagih"
3. Isi nilai Drop Point untuk setiap row
4. Save dan upload ulang

---

### Option 2: Add Fallback Logic (Quick Fix) 🔧

**File:** `services/merge_service.py`

**Add Code:**
```python
# If Drop Point missing, use DP Outgoing as fallback
if 'Drop Point' not in self.df_monitor.columns:
    logger.warning("Drop Point column missing, using DP Outgoing as fallback")
    if 'DP Outgoing' in self.df_monitor.columns:
        self.df_monitor['Drop Point'] = self.df_monitor['DP Outgoing']
```

**Result:** Drop Point akan diisi dengan nilai dari "DP Outgoing"

---

### Option 3: Clear Database & Re-import Clean Data 🧹

**Steps:**
1. Clear database
2. Prepare Excel file with correct columns
3. Re-import with clean data

**Command:**
```bash
# Clear database
python -c "from config.database import get_connection; c=get_connection(); cur=c.cursor(); cur.execute('TRUNCATE TABLE shipments'); cur.execute('TRUNCATE TABLE shipments_histories'); c.commit(); print('Database cleared')"

# Then upload clean Excel files via web UI
# Then run merge
```

---

## ✅ RECOMMENDED ACTION PLAN

### Immediate (Hari Ini)
1. **Clear Database** - Hapus semua data yang salah
2. **Prepare Clean Excel** - Pastikan kolom "Drop Point" ada
3. **Re-import** - Upload dan merge ulang

### Short Term (Minggu Ini)
1. **Standardize Excel Template** - Buat template baku dengan semua kolom required
2. **Add Validation** - Tolak file yang tidak punya kolom required
3. **Add Warning** - Tampilkan warning jika ada kolom missing

### Long Term (Next Sprint)
1. **Add Data Quality Report** - Tampilkan % data lengkap per kolom
2. **Add Column Mapping UI** - User bisa map kolom manual jika nama berbeda
3. **Add Historical Data** - Store old mappings

---

## 📝 FILES INVOLVED

### Excel Files
| File | Rows | Drop Point | Waktu Sampai | Status |
|------|------|------------|--------------|--------|
| `Monitor Sampai...204423.xlsx` | 447 | ✅ BULI | ✅ 2026-03-01 | GOOD |
| `Monitor Sampai...005951.xlsx` | 2,101 | ❌ MISSING | ⚠️ Mixed | NEEDS FIX |

### Code Files
| File | Line | Issue |
|------|------|-------|
| `services/merge_service.py` | 223 | No fallback for missing Drop Point |
| `web/frontend/src/App.jsx` | 520-595 | Heatmap code working correctly |

---

## 🧪 TESTING CHECKLIST

Setelah fix, verify:
- [ ] Drop Point NOT NULL > 90%
- [ ] Waktu Sampai sesuai dengan Excel
- [ ] Heatmap menampilkan semua Drop Points
- [ ] Heatmap menampilkan semua dates (last 7 days)
- [ ] Cell coloring bekerja (🟢🟡🔴)
- [ ] Click cell menampilkan waybill details

---

## 📊 CURRENT HEATMAP STATE

### What User Sees
```
╔════════════════════════════════════════════════════════╗
║  Heatmap Report - Drop Point Performance (Last 7 Days) ║
╠════════════════════════════════════════════════════════╣
║  🟢 Good (0-50)  🟡 Warning (50-200)  🔴 Bad (>200)   ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Drop Point  │  03-01  │  03-02  │  ...  │   TOTAL    ║
║  ───────────────────────────────────────────────────   ║
║  BULI        │  🔴 446 │   -     │  ...  │    446     ║
║  Unknown     │    -    │   -     │  ...  │      0     ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

⚠️ 2,087 records missing (82% of data)
```

### What User Should See
```
╔════════════════════════════════════════════════════════╗
║  Heatmap Report - Drop Point Performance (Last 7 Days) ║
╠════════════════════════════════════════════════════════╣
║  Drop Point  │  03-01  │  03-02  │  ...  │   TOTAL    ║
║  ───────────────────────────────────────────────────   ║
║  BULI        │  🔴 446 │   -     │  ...  │    446     ║
║  [New DP 1]  │    -    │  🟡 50  │  ...  │    500     ║
║  [New DP 2]  │    -    │  🟢 30  │  ...  │    600     ║
║  ...         │   ...   │  ...    │  ...  │    ...     ║
╚════════════════════════════════════════════════════════╝

✅ All 2,533 records displayed
```

---

## 🎯 FINAL VERDICT

### Heatmap Code: ✅ WORKING (9/10)
### Excel Data: ❌ INCONSISTENT (2 different formats)
### Database: ⚠️ MIXED (18% good, 82% missing Drop Point)

**Overall Status:** ⚠️ **FEATURE COMPROMISED**

**Root Cause:** User uploaded 2 different Excel file formats:
- Old format: Has Drop Point column
- New format: Missing Drop Point column

**Solution:** Standardize Excel template OR add fallback logic

---

**Audit Completed:** 2026-03-29  
**Priority:** 🔴 HIGH  
**Estimated Fix Time:** 30 minutes (add fallback) or 5 minutes (clear + re-import)
