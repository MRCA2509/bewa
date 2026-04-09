# Business Logic Fix - History Categorization

## 🐛 Problem Found

**Issue:** Semua 447 records dipindahkan ke tabel `shipments_histories`, tidak ada yang tersisa di tabel `shipments` (aktif).

**Expected:** Seharusnya ada **1 AWB** yang tetap aktif di tabel utama.

---

## 🔍 Root Cause Analysis

### Old Logic (WRONG) ❌

```python
def is_history_rule(jenis_scan: str, station_scan: str) -> bool:
    # Rule 1: TTD scans
    if jenis_scan in TTD_SCAN_TYPES:
        return True
    
    # Rule 2: Not in active locations
    if station_scan not in ACTIVE_LOCATIONS:
        return True
    
    # Rule 3: NOT Scan Pickup ← THIS IS THE BUG!
    if jenis_scan != 'Scan Pickup':
        return True
    
    return False
```

**Problem:** Rule 3 terlalu agresif! Semua scan types selain 'Scan Pickup' masuk histori, termasuk:
- ❌ Scan Kirim (masih dalam proses)
- ❌ Pack (masih dalam proses)
- ❌ Scan Paket Bermasalah (masih dalam proses)
- ❌ Scan Kirim Mobil (masih dalam proses)

### Impact

| Jenis Scan | Station | Old Logic | Correct |
|------------|---------|-----------|---------|
| Scan TTD | BULI | HISTORY ✅ | HISTORY ✅ |
| Scan TTD Retur | PANGKALAN_TELUKNAGA | HISTORY ✅ | HISTORY ✅ |
| **Scan Kirim** | **BULI** | **HISTORY ❌** | **AKTIF ✅** |
| **Pack** | **BULI** | **HISTORY ❌** | **AKTIF ✅** |
| **Scan Paket Bermasalah** | **BULI** | **HISTORY ❌** | **AKTIF ✅** |
| Scan Kirim | TCSLM101 | HISTORY ✅ | HISTORY ✅ |

---

## ✅ Solution

### New Logic (CORRECT)

```python
def is_history_rule(jenis_scan: str, station_scan: str) -> bool:
    # Rule 1: TTD scans = pengiriman selesai
    if jenis_scan in ['Scan TTD', 'Scan TTD Retur']:
        return True
    
    # Rule 2: Station bukan lokasi aktif = keluar dari jaringan
    if station_scan not in ACTIVE_LOCATIONS:
        return True
    
    # Default: Tetap aktif (masih dalam proses di lokasi aktif)
    return False
```

### Active Locations

```python
ACTIVE_LOCATIONS = [
    'MABA', 'BULI', 'WASILE', 'SOFIFI',
    'LABUHA', 'FALAJAWA2', 'SANANA', 'BOBONG'
]
```

### Active Scan Types (should stay in active table)

```python
ACTIVE_SCAN_TYPES = [
    'Scan Pickup',
    'Scan Kirim',
    'Scan Kirim Mobil',
    'Pack',
    'Scan Paket Bermasalah'
]
```

---

## 🧪 Test Results

### Before Fix

```
Active shipments:   0 ❌
History shipments:  447
Total:              447
```

### After Fix

```
Active shipments:   1 ✅
History shipments:  446 ✅
Total:              447 ✅
```

### Active Shipment Detail

```
Waybill: JX7306962486
Tujuan: MABA
Jenis Scan: Scan Paket Bermasalah
Station Scan: BULI
```

**Verification:** ✅ CORRECT!
- `Scan Paket Bermasalah` = masih dalam proses penanganan
- `BULI` = lokasi aktif
- Should remain in `shipments` table (active)

---

## 📊 Data Distribution

### Status Terupdate - Jenis Scan Breakdown

| Jenis Scan | Count | Should Be |
|------------|-------|-----------|
| Scan TTD | 261 | HISTORY |
| Scan TTD Retur | 182 | HISTORY |
| Scan Paket Bermasalah | 1 | **AKTIF** ✅ |
| Pack | 1 | HISTORY (station not active) |
| Scan Kirim | 1 | HISTORY (station not active) |
| Scan Kirim Mobil | 1 | HISTORY (station not active) |

### Station Scan Distribution

| Station | Count | Category |
|---------|-------|----------|
| BULI | 258 | Active Location |
| PANGKALAN_TELUKNAGA | 10 | Not Active |
| TAMBORA | 9 | Not Active |
| ... (116 others) | ... | Not Active |

---

## 📝 Files Modified

1. **config/constants.py**
   - Removed incorrect Rule 3 (`jenis_scan != 'Scan Pickup'`)
   - Added `ACTIVE_SCAN_TYPES` constant
   - Updated `is_history_rule()` logic
   - Updated `get_archive_reason()` logic

2. **models/shipment.py**
   - Updated import: `PICKUP_SCAN` → `ACTIVE_SCAN_TYPES`

3. **test_logic.py** (NEW)
   - Added comprehensive test cases
   - All 11 tests passed ✅

4. **verify_active.py** (NEW)
   - Verified raw Excel data
   - Confirmed 1 active shipment is correct

---

## 🎯 Business Logic Summary

### Goes to HISTORY if:
1. ✅ `Scan TTD` or `Scan TTD Retur` (delivery completed)
2. ✅ Station scan NOT in active locations (left network)

### Stays ACTIVE if:
1. ✅ Scan type is still in process (Scan Kirim, Pack, etc.)
2. ✅ Station scan is in active locations

---

## ✅ Validation

```bash
# Run tests
python test_logic.py

# Verify database
python check_db.py

# Verify against raw data
python verify_active.py
```

All validations passed! ✅

---

## 📚 Related Documentation

- `SMART_MERGE_LOGIC.md` - Smart deduplication logic
- `CHANGELOG.md` - All changes log
- `README.md` - General documentation

---

**Fixed:** 2026-03-29
**Status:** ✅ Production Ready
**Active Shipments:** 1 (JX7306962486)
**History Shipments:** 446
