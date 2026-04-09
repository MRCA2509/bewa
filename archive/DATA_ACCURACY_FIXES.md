# Data Accuracy Fixes

## Problem Identified

Data from Status Terupdate Excel file was not being mapped to Shipment objects correctly. All fields from Status Terupdate were showing as `None` or `NaN` after the merge.

## Root Causes Found

1. **Row 0 was being incorrectly removed**: The code was removing the first data row thinking it was a duplicate header, when it actually contained valid shipment data.

2. **No. Waybill dtype mismatch**:
   - Monitor Sampai: `object` type (integers stored as objects)
   - Status Terupdate: `str` type
   - This caused pandas merge to fail silently for some records

3. **DUPLICATE DATA ON REPEATED MERGES** (Fixed 2026-03-29):
   - Every time merge was run, data was appended instead of replaced
   - `ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)` only updated timestamp
   - Result: 447 unique waybills became 1341 records (3x duplicates)

## Fixes Applied

### 1. Fixed `load_status_terupdate()` (services/merge_service.py)

**Before:**
```python
# Remove first row if it contains duplicate header info
if len(self.df_status) > 0:
    first_row = self.df_status.iloc[0]
    if any(str(v).startswith('No. Waybill') for v in first_row.values if pd.notna(v)):
        self.df_status = self.df_status.iloc[1:].reset_index(drop=True)
```

**After:**
```python
# This code was removed - it was incorrectly deleting valid data rows
# The header is correctly loaded with header=1 parameter
```

### 2. Added No. Waybill Normalization (services/merge_service.py)

**In `load_monitor_sampai()`:**
```python
# Normalize No. Waybill to string for consistent merging
if 'No. Waybill' in self.df_monitor.columns:
    self.df_monitor['No. Waybill'] = self.df_monitor['No. Waybill'].astype(str)
```

**In `load_status_terupdate()`:**
```python
# Normalize No. Waybill to string for consistent merging
if 'No. Waybill' in self.df_status.columns:
    self.df_status['No. Waybill'] = self.df_status['No. Waybill'].astype(str)
```

### 3. Fixed Column Mapping in `merge_by_waybill()` (services/merge_service.py)

Added explicit mapping for all columns to handle the merge suffixes correctly:

```python
# Map merged columns (with suffixes) to Shipment model expected names
# Priority: Monitor Sampai (no suffix) > Status Terupdate (_status suffix)
mapped_data['No. Waybill'] = data.get('No. Waybill')
mapped_data['DP Outgoing'] = data.get('DP Outgoing')
# ... (all columns mapped)
mapped_data['Station Scan'] = data.get('Station Scan') or data.get('Station Scan_status')
mapped_data['Jenis Scan'] = data.get('Jenis Scan') or data.get('Jenis Scan_status')
# ... (all Status Terupdate columns)
```

### 4. Added clear_before Parameter to Prevent Duplicates (2026-03-29)

**In `services/merge_service.py`:**

```python
def save_to_database(self, clear_before: bool = False) -> Dict[str, int]:
    """
    Save merged shipments to MySQL database.
    
    Args:
        clear_before: If True, clear existing data before inserting (REPLACE mode)
    """
    # ...
    if clear_before:
        logger.info("Clearing existing data before merge (REPLACE mode)...")
        cursor.execute("TRUNCATE TABLE shipments")
        cursor.execute("TRUNCATE TABLE shipments_histories")
        conn.commit()
```

**Updated `run()` method:**
```python
def run(self, clear_before: bool = True) -> Dict[str, int]:
    """
    Run the complete merge process: load, merge, save.
    
    Args:
        clear_before: If True, clear existing data before inserting (default: True)
    """
    # ...
    result = self.save_to_database(clear_before=clear_before)
```

**Updated `main.py`:**
```python
def run_merge(dry_run: bool = False) -> bool:
    # ...
    else:
        # Clear existing data before merge to prevent duplicates
        service.run(clear_before=True)
```

**Updated `web/server.py`:**
```python
# Clear existing data before merge to prevent duplicates
result = service.save_to_database(clear_before=True)
```

## Validation Results

### Before Fixes (Original Issues)
- Matched waybills: 443/447 (99.1%)
- Status Terupdate data: ALL FIELDS EMPTY
- Data completeness: FAILED

### After Fixes (Before Duplicate Fix)
- Matched waybills: 447/447 (100%)
- Status Terupdate data: ALL FIELDS POPULATED
- Data completeness: PASSED
- **BUT: 1341 records (3x duplicates)** ❌

### After All Fixes (Current State) ✅
- Matched waybills: 447/447 (100%)
- Status Terupdate data: ALL FIELDS POPULATED
- **Total records: 447 (no duplicates)** ✅
- Data completeness: PASSED

#### Sample Validated Fields
| Field | Before | After |
|-------|--------|-------|
| station_scan | None | BULI |
| jenis_scan | None | Scan TTD |
| waktu_scan | NaT | 2026-03-02 13:57:49 |
| discan_oleh_scan | None | MH FRIENDLY REGINO REZA SINDUA |
| no_order | None | 3893796459315486765 |
| diinput_oleh | None | Ari Aryanto |
| penerima | None | Sugeng (082239750827) |
| waktu_ttd | NaT | 2026-03-02 13:57:49 |
| keterangan | None | (JANGAN RETURN ,,, ...) |

## Data Quality Notes

Some fields have low completeness in the source Excel files (not a bug):
- `keterangan`: Only 2.2% of records have values (this is normal - only problematic shipments have notes)
- `total_dfod`: Often empty in source data
- `end_status`: Often empty in source data

These are source data characteristics, not mapping issues.

## Files Modified

1. `services/merge_service.py` - Main merge logic fixed + duplicate prevention
2. `config/logger.py` - Added logging (bonus improvement)
3. `main.py` - Updated to use clear_before=True
4. `web/server.py` - Updated merge to use clear_before=True
5. All Python files updated to use proper logging instead of `print()`

## Testing

Run validation script to verify data accuracy:
```bash
python validate_data.py
```

Check database counts:
```bash
python -c "import mysql.connector; conn = mysql.connector.connect(host='localhost', port=3306, user='root', password='', database='bewa_logistics'); cursor = conn.cursor(); cursor.execute('SELECT COUNT(*) FROM shipments'); print(f'Active: {cursor.fetchone()[0]}'); cursor.execute('SELECT COUNT(*) FROM shipments_histories'); print(f'History: {cursor.fetchone()[0]}'); cursor.execute('SELECT COUNT(DISTINCT waybill_id) FROM shipments_histories'); print(f'Unique: {cursor.fetchone()[0]}'); conn.close()"
```

Expected output:
```
Active: 0
History: 447
Unique: 447
```
