import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import get_connection
from datetime import datetime
from dateutil.relativedelta import relativedelta

conn = get_connection()
cursor = conn.cursor(dictionary=True)

current_month = datetime.now().strftime("%Y-%m")
last_month = (datetime.now() - relativedelta(months=1)).strftime("%Y-%m")

# For testing, we might not have data for April. Let's explicitly check what months exist.
cursor.execute(
    "SELECT MAX(DATE_FORMAT(waktu_sampai, '%Y-%m')) as max_m FROM shipments WHERE waktu_sampai != '0001-01-01'"
)
res = cursor.fetchone()
if res and res["max_m"]:
    current_month = res["max_m"]
    dt = datetime.strptime(current_month, "%Y-%m")
    last_month = (dt - relativedelta(months=1)).strftime("%Y-%m")

print(f"Using Current Month: {current_month}, Last Month: {last_month}")

query = """
SELECT 
    drop_point,
    COALESCE(CAST(ROUND(SUM(CASE WHEN DATE_FORMAT(date, '%Y-%m') = %s THEN total_cnt ELSE 0 END) / 
               NULLIF(COUNT(DISTINCT CASE WHEN DATE_FORMAT(date, '%Y-%m') = %s THEN date END), 0), 0) AS SIGNED), 0) as avg_current,
    COALESCE(CAST(ROUND(SUM(CASE WHEN DATE_FORMAT(date, '%Y-%m') = %s THEN total_cnt ELSE 0 END) / 
               NULLIF(COUNT(DISTINCT CASE WHEN DATE_FORMAT(date, '%Y-%m') = %s THEN date END), 0), 0) AS SIGNED), 0) as avg_last,
    COALESCE(CAST(SUM(CASE WHEN is_active = 1 AND DATE_FORMAT(date, '%Y-%m') = %s THEN active_cnt ELSE 0 END) AS SIGNED), 0) as active_current
FROM (
    SELECT drop_point, DATE(waktu_sampai) as date, 1 as is_active, COUNT(*) as active_cnt, COUNT(*) as total_cnt
    FROM shipments
    WHERE waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'
    GROUP BY drop_point, DATE(waktu_sampai)
    
    UNION ALL
    
    SELECT drop_point, DATE(waktu_sampai) as date, 0 as is_active, 0 as active_cnt, COUNT(*) as total_cnt
    FROM shipments_histories
    WHERE waktu_sampai IS NOT NULL AND waktu_sampai != '0001-01-01'
    GROUP BY drop_point, DATE(waktu_sampai)
) AS daily
WHERE drop_point IN ('MABA', 'BULI', 'WASILE', 'SOFIFI', 'LABUHA', 'FALAJAWA2', 'SANANA', 'BOBONG')
GROUP BY drop_point
ORDER BY avg_current DESC
"""

cursor.execute(
    query, (current_month, current_month, last_month, last_month, current_month)
)
for row in cursor.fetchall():
    print(row)

cursor.close()
conn.close()
