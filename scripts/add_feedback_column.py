import os
import sys
import mysql.connector

# Add project root to path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from config.database import DB_CONFIG


def migrate_feedback():
    conn = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Add feedback column to shipments
        try:
            cursor.execute(
                "ALTER TABLE shipments ADD COLUMN feedback TEXT AFTER last_status_sync_at"
            )
            print("Successfully added 'feedback' column to 'shipments' table.")
        except mysql.connector.Error as err:
            if err.errno == 1060:  # Column already exists
                print("Column 'feedback' already exists in 'shipments' table.")
            else:
                print(f"Error adding to 'shipments': {err}")

        # Add feedback column to shipments_histories
        try:
            cursor.execute(
                "ALTER TABLE shipments_histories ADD COLUMN feedback TEXT AFTER last_status_sync_at"
            )
            print(
                "Successfully added 'feedback' column to 'shipments_histories' table."
            )
        except mysql.connector.Error as err:
            if err.errno == 1060:  # Column already exists
                print(
                    "Column 'feedback' already exists in 'shipments_histories' table."
                )
            else:
                print(f"Error adding to 'shipments_histories': {err}")

        conn.commit()
        print("Migration completed.")

    except mysql.connector.Error as err:
        print(f"Database error: {err}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    migrate_feedback()
