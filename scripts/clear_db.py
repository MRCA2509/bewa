import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import get_connection, close_connection


def clear_database():
    conn = get_connection()
    if not conn:
        print("❌ Error: Could not connect to database.")
        return False

    try:
        cursor = conn.cursor()
        print("🧹 Clearing 'shipments' table...")
        cursor.execute("TRUNCATE TABLE shipments;")

        print("🧹 Clearing 'shipments_histories' table...")
        cursor.execute("TRUNCATE TABLE shipments_histories;")

        conn.commit()
        print("✅ Database tables cleared successfully.")
        return True
    except Exception as e:
        print(f"❌ Error executing TRUNCATE: {e}")
        return False
    finally:
        cursor.close()
        close_connection(conn)


if __name__ == "__main__":
    print("=" * 40)
    print("BEWA LOGISTICS - DATABASE RESET TOOL")
    print("=" * 40)
    success = clear_database()
    if success:
        print("\nAll data has been cleared.")
    else:
        print("\nAn error occurred during database clear.")
    print("=" * 40)
