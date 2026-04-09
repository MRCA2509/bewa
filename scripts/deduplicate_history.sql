-- ============================================
-- SCRIPT: Deduplicate shipments_histories
-- ============================================
USE bewa_logistics;

-- 0. Cleanup from previous failed runs
DROP TABLE IF EXISTS shipments_histories_new;

-- 1. Create a new table with the correct schema
CREATE TABLE shipments_histories_new LIKE shipments_histories;

-- 2. Modify NEW table to use waybill_id as PRIMARY KEY
-- (This ensures UNIQUE constraint is enforced)
ALTER TABLE shipments_histories_new DROP COLUMN history_id;
ALTER TABLE shipments_histories_new MODIFY waybill_id VARCHAR(50) PRIMARY KEY;

-- 3. Insert only the LATEST records from the old table
-- Using a subquery to get the max(updated_at) or max(waktu_scan) per waybill
INSERT INTO shipments_histories_new
SELECT t1.* FROM shipments_histories t1
INNER JOIN (
    SELECT waybill_id, MAX(COALESCE(waktu_scan, '1970-01-01')) as max_scan
    FROM shipments_histories
    GROUP BY waybill_id
) t2 ON t1.waybill_id = t2.waybill_id AND COALESCE(t1.waktu_scan, '1970-01-01') = t2.max_scan
GROUP BY t1.waybill_id; -- Extra GROUP BY as safety for duplicate timestamps

-- 4. Swap tables
RENAME TABLE shipments_histories TO shipments_histories_old,
             shipments_histories_new TO shipments_histories;

-- 5. Drop old table after verification
DROP TABLE shipments_histories_old;

-- 6. Verify result
SELECT 'Resulting count' AS label, COUNT(*) FROM shipments_histories;
