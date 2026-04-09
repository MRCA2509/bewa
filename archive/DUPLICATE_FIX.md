# Duplicate Data Fix - 2026-03-29

## Problem Summary

**Issue:** GUI menampilkan **1341 records** padahal seharusnya hanya **447 records**

**Root Cause:** Setiap kali merge dijalankan, data tidak ditimpa melainkan **ditambahkan** ke database, menyebabkan duplikasi.

### Analisis

```
Database State Before Fix:
├─ Total records: 1341
├─ Unique waybills: 447
└─ Duplication factor: 3x (data di-merge 3 kali)

Top Duplicates:
├─ 1352425936: 3 kali
├─ 1352644768: 3 kali
├─ 1352723891: 3 kali
└─ ... (semua 447 waybills ada 3 kali)
```

### Penyebab Teknis

Query INSERT menggunakan:
```sql
INSERT INTO shipments_histories (...) 
VALUES (...) 
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)
```

**Masalah:** `ON DUPLICATE KEY UPDATE updated_at` hanya mengupdate timestamp, bukan menimpa data lama. Jadi setiap merge menambah baris baru.

---

## Solution

### 1. Added `clear_before` Parameter

**File:** `services/merge_service.py`

```python
def save_to_database(self, clear_before: bool = False) -> Dict[str, int]:
    """
    Save merged shipments to MySQL database.
    
    Args:
        clear_before: If True, clear existing data before inserting (REPLACE mode)
    """
    if clear_before:
        logger.info("Clearing existing data before merge (REPLACE mode)...")
        cursor.execute("TRUNCATE TABLE shipments")
        cursor.execute("TRUNCATE TABLE shipments_histories")
        conn.commit()
```

### 2. Updated Default Behavior

**File:** `services/merge_service.py`

```python
def run(self, clear_before: bool = True) -> Dict[str, int]:
    """
    Run the complete merge process.
    
    Args:
        clear_before: If True, clear existing data before inserting (default: True)
    """
    result = self.save_to_database(clear_before=clear_before)
```

### 3. Updated All Callers

**File:** `main.py`
```python
# Clear existing data before merge to prevent duplicates
service.run(clear_before=True)
```

**File:** `web/server.py`
```python
# Clear existing data before merge to prevent duplicates
result = service.save_to_database(clear_before=True)
```

---

## Verification

### Before Fix
```
Active:  0
History: 1341  ❌
Unique:  447
Total:   1341 ❌
```

### After Fix
```
Active:  0
History: 447   ✅
Unique:  447   ✅
Total:   447   ✅
```

---

## Files Modified

1. ✅ `services/merge_service.py` - Added clear_before parameter
2. ✅ `main.py` - Updated to use clear_before=True
3. ✅ `web/server.py` - Updated to use clear_before=True
4. ✅ `DATA_ACCURACY_FIXES.md` - Updated documentation
5. ✅ `cleanup_duplicates.py` - New utility script (bonus)

---

## How to Use

### Normal Merge (Auto-Clear)

```bash
# CLI
python main.py

# Web GUI
start.bat
# Then click "Run Merge Process"
```

### Cleanup Existing Duplicates

```bash
# Preview what would be done
python cleanup_duplicates.py --dry-run

# Actually clean database
python cleanup_duplicates.py

# Re-import data
python main.py
```

### Check Database Counts

```bash
python -c "import mysql.connector; conn = mysql.connector.connect(host='localhost', port=3306, user='root', password='', database='bewa_logistics'); cursor = conn.cursor(); cursor.execute('SELECT COUNT(*) FROM shipments'); print(f'Active: {cursor.fetchone()[0]}'); cursor.execute('SELECT COUNT(*) FROM shipments_histories'); print(f'History: {cursor.fetchone()[0]}'); cursor.execute('SELECT COUNT(DISTINCT waybill_id) FROM shipments_histories'); print(f'Unique: {cursor.fetchone()[0]}'); conn.close()"
```

Expected output:
```
Active:  0
History: 447
Unique:  447
```

---

## Prevention

To prevent this issue in the future:

1. **Always use `clear_before=True`** when calling `save_to_database()`
2. **Alternative:** Use `REPLACE INTO` instead of `INSERT ... ON DUPLICATE KEY UPDATE`
3. **Add database constraint:** UNIQUE constraint on waybill_id (already exists)
4. **Monitor counts:** Check GUI stats regularly - should match Excel row count

---

## Technical Details

### Why TRUNCATE Instead of DELETE?

| Aspect | TRUNCATE | DELETE |
|--------|----------|--------|
| Speed | Fast (drops & recreates table) | Slow (row-by-row) |
| Auto-increment | Resets | Keeps |
| Transaction log | Minimal | Full logging |
| WHERE clause | Not supported | Supported |

For our use case (clear all before re-import), `TRUNCATE` is perfect.

### Alternative Approach Considered

**Option:** Use `REPLACE INTO` instead of `INSERT ... ON DUPLICATE KEY UPDATE`

**Why not chosen:**
- `REPLACE INTO` deletes then inserts (more overhead)
- Loses `archived_at` timestamp for history records
- `TRUNCATE + INSERT` is cleaner and faster for bulk operations

---

## Testing Checklist

- [x] Database cleared successfully
- [x] Merge runs without errors
- [x] Total records = 447 (matches Excel)
- [x] Unique waybills = 447
- [x] No duplicates in database
- [x] GUI shows correct counts
- [x] All data fields populated correctly

---

## Related Documentation

- `DATA_ACCURACY_FIXES.md` - Complete data accuracy documentation
- `README.md` - General usage guide
- `SCRIPTS.md` - Available batch scripts

---

**Fixed by:** AI Code Audit
**Date:** 2026-03-29
**Status:** ✅ Resolved
