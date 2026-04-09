import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import get_connection, close_connection


def setup_feedback_table():
    conn = get_connection()
    if not conn:
        print("Failed to connect to database")
        return

    try:
        cursor = conn.cursor()
        print("Creating 'waybill_feedbacks' table if not exists...")

        create_table_sql = """
        CREATE TABLE IF NOT EXISTS waybill_feedbacks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            waybill_id VARCHAR(50) NOT NULL,
            reported_by VARCHAR(100) NOT NULL,
            feedback_text TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_waybill_id (waybill_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """

        cursor.execute(create_table_sql)
        print("Table 'waybill_feedbacks' created successfully or already exists.")

        conn.commit()
    except Exception as e:
        print(f"Error creating table: {e}")
    finally:
        cursor.close()
        close_connection(conn)


if __name__ == "__main__":
    setup_feedback_table()
