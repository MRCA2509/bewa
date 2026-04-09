# Upload Flow Fix - Prevent Premature Merge

## 🐛 Problem

**Issue:** Saat upload file Monitor Sampai saja, aplikasi langsung otomatis menentukan aktif/history data, padahal butuh Status Terupdate untuk menentukan kategorisasi.

**Root Cause:** Frontend secara otomatis trigger merge setelah upload file pertama (Monitor Sampai), sehingga data diproses tanpa `jenis_scan` dan `station_scan` dari Status Terupdate.

### Bug Location

**File:** `web/frontend/src/App.jsx`

```javascript
// Line 113-114 (BEFORE - BUG) ❌
if (data.success) {
    alert(`File uploaded: ${data.filename}`)
    handleMerge()  // ← AUTO-TRIGGER MERGE! (WRONG)
}
```

### Why This Is Wrong

| Step | What Happens | Problem |
|------|--------------|---------|
| 1. Upload Monitor Sampai | File saved, auto-trigger merge | ❌ Merge runs with only partial data |
| 2. Merge Process | `jenis_scan` and `station_scan` are NULL/empty | ❌ Cannot categorize correctly |
| 3. is_history() | Evaluates `is_history_rule('', '')` | ❌ Returns wrong result |
| 4. Database | All data goes to wrong table | ❌ Data integrity issue |

---

## ✅ Solution

### 1. Remove Auto-Trigger Merge (Frontend)

**File:** `web/frontend/src/App.jsx`

```javascript
// AFTER - FIXED ✅
if (data.success) {
    alert(`File uploaded: ${data.filename}\n\nPlease upload the other file and then click "Run Merge Process" to merge data.`)
    // DO NOT auto-trigger merge - wait for user to click button
    // This ensures both Monitor Sampai and Status Terupdate are uploaded before merging
}
```

### 2. Add Validation (Backend)

**File:** `services/merge_service.py`

```python
def run(self, clear_before: bool = False, use_smart_merge: bool = True):
    self.load_monitor_sampai()
    self.load_status_terupdate()
    
    # Validate both files are loaded
    if self.df_monitor is None or self.df_status is None:
        logger.error("ERROR: Both Monitor Sampai and Status Terupdate files are required!")
        logger.error("  Please upload both Excel files before running merge.")
        return {'active_inserted': 0, 'history_inserted': 0}
    
    self.merge_by_waybill()
    # ... rest of merge
```

---

## 🔄 Correct Upload Flow

### Before Fix (WRONG) ❌

```
User uploads Monitor Sampai
    ↓
Auto-trigger merge ❌
    ↓
Merge with partial data (no Status Terupdate)
    ↓
jenis_scan = NULL, station_scan = NULL
    ↓
is_history_rule('', '') → TRUE (bug!)
    ↓
ALL data → HISTORY table ❌
```

### After Fix (CORRECT) ✅

```
User uploads Monitor Sampai
    ↓
File saved, NO merge yet ✅
    ↓
User uploads Status Terupdate
    ↓
File saved, NO merge yet ✅
    ↓
User clicks "Run Merge Process" ✅
    ↓
Merge with BOTH files
    ↓
jenis_scan and station_scan populated ✅
    ↓
is_history_rule() evaluates correctly ✅
    ↓
Data categorized correctly ✅
```

---

## 📊 Impact

### Before Fix

| Scenario | Result |
|----------|--------|
| Upload Monitor Sampai only | ❌ All data → HISTORY (wrong!) |
| Upload Status Terupdate only | ❌ All data → HISTORY (wrong!) |
| Upload both files | ✅ Correct categorization |

### After Fix

| Scenario | Result |
|----------|--------|
| Upload Monitor Sampai only | ✅ No merge (wait for user) |
| Upload Status Terupdate only | ✅ No merge (wait for user) |
| Upload both + click Merge | ✅ Correct categorization |

---

## 🧪 Testing

### Test Case 1: Upload Monitor Sampai Only

**Before Fix:**
```
Upload Monitor Sampai → Auto merge → All 447 records → HISTORY ❌
```

**After Fix:**
```
Upload Monitor Sampai → No merge → 0 records in DB ✅
Message: "Please upload the other file and then click Run Merge Process"
```

### Test Case 2: Upload Both Files

**Before Fix:**
```
Upload Monitor Sampai → Auto merge (wrong data) ❌
Upload Status Terupdate → Auto merge again (duplicate!) ❌
```

**After Fix:**
```
Upload Monitor Sampai → No merge ✅
Upload Status Terupdate → No merge ✅
Click "Run Merge Process" → Correct merge ✅
  - Active: 1
  - History: 446
```

---

## 📝 Files Modified

| File | Change |
|------|--------|
| `web/frontend/src/App.jsx` | Removed auto-trigger merge after upload |
| `services/merge_service.py` | Added validation for both files |

---

## 🎯 User Experience

### Before Fix

1. Upload Monitor Sampai
2. ⚠️ **Surprise!** Data already merged (wrong)
3. Upload Status Terupdate
4. ⚠️ **Surprise!** Data merged again (duplicates)
5. Confused user doesn't know what happened

### After Fix

1. Upload Monitor Sampai
2. ✅ **Clear message:** "Please upload the other file and click Run Merge Process"
3. Upload Status Terupdate
4. ✅ **Clear message:** Same
5. User clicks "Run Merge Process" when ready
6. ✅ **Correct result** with proper categorization

---

## 📚 Related Documentation

- `BUSINESS_LOGIC_FIX.md` - History categorization logic fix
- `SMART_MERGE_LOGIC.md` - Deduplication logic
- `CHANGELOG.md` - All changes log

---

**Fixed:** 2026-03-29
**Status:** ✅ Production Ready
**User Experience:** Much clearer - explicit control over merge process
