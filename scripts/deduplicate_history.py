import sys
import os

# Add project root to path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from config.database import get_connection, close_connection


def deduplicate():
    print("Starting deduplication of shipments_histories...")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # 1. Get all waybills
        cursor.execute("SELECT DISTINCT waybill_id FROM shipments_histories")
        waybills = [row["waybill_id"] for row in cursor.fetchall() if row["waybill_id"]]
        print(f"Found {len(waybills)} unique waybills in history.")

        # 2. Create a backup/temporary table for the deduplicated data
        # First, ensure the current schema is what we want for the history
        # (We'll just create a new table with the DESIRED schema from a new script)
        cursor.execute("DROP TABLE IF EXISTS shipments_histories_clean")

        # Get column definitions from init_database.sql effectively
        # But easier: just use the same columns as shipments_histories minus history_id
        cursor.execute("DESCRIBE shipments_histories")
        columns = cursor.fetchall()
        col_names = [c["Field"] for c in columns if c["Field"] != "history_id"]

        # Create table with PK on waybill_id
        create_sql = f"CREATE TABLE shipments_histories_clean AS SELECT {', '.join(col_names)} FROM shipments_histories LIMIT 0"
        cursor.execute(create_sql)
        cursor.execute(
            "ALTER TABLE shipments_histories_clean ADD PRIMARY KEY (waybill_id)"
        )

        print("Migrating latest records...")
        # 3. For each waybill, get the latest record and insert it
        # We'll use a single query for efficiency if possible
        migrate_sql = f"""
            INSERT INTO shipments_histories_clean ({", ".join(col_names)})
            SELECT {", ".join(col_names)} FROM (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY waybill_id ORDER BY waktu_scan DESC, updated_at DESC) as rn
                FROM shipments_histories
            ) t WHERE rn = 1
        """
        cursor.execute(migrate_sql)
        conn.commit()

        # 4. Swap tables
        cursor.execute(
            "RENAME TABLE shipments_histories TO shipments_histories_old, shipments_histories_clean TO shipments_histories"
        )
        cursor.execute("DROP TABLE shipments_histories_old")

        print("Successfully deduplicated shipments_histories!")
        cursor.execute("SELECT COUNT(*) as count FROM shipments_histories")
        print(f"Total unique records remaining: {cursor.fetchone()['count']}")

    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cursor.close()
        close_connection(conn)


if __name__ == "__main__":
    deduplicate()
