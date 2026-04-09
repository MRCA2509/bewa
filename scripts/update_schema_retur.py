import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import get_connection, close_connection


def update_schema():
    conn = get_connection()
    if not conn:
        print("Failed to connect to database")
        return

    try:
        cursor = conn.cursor()
        print("Adding 'waktu_konfirmasi_retur' to 'shipments'...")
        # Check if column exists first
        cursor.execute("SHOW COLUMNS FROM shipments LIKE 'waktu_konfirmasi_retur'")
        if not cursor.fetchone():
            cursor.execute(
                "ALTER TABLE shipments ADD COLUMN waktu_konfirmasi_retur DATETIME AFTER waktu_regis_retur"
            )
            print("Added to 'shipments'")
        else:
            print("Column already exists in 'shipments'")

        print("Adding 'waktu_konfirmasi_retur' to 'shipments_histories'...")
        cursor.execute(
            "SHOW COLUMNS FROM shipments_histories LIKE 'waktu_konfirmasi_retur'"
        )
        if not cursor.fetchone():
            cursor.execute(
                "ALTER TABLE shipments_histories ADD COLUMN waktu_konfirmasi_retur DATETIME AFTER waktu_regis_retur"
            )
            print("Added to 'shipments_histories'")
        else:
            print("Column already exists in 'shipments_histories'")

        conn.commit()
    except Exception as e:
        print(f"Error updating schema: {e}")
    finally:
        cursor.close()
        close_connection(conn)


if __name__ == "__main__":
    update_schema()
