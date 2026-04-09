import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.database import get_connection


def describe_table(table_name):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"DESCRIBE {table_name}")
    for row in cursor.fetchall():
        print(row)
    conn.close()


if __name__ == "__main__":
    describe_table("shipments")
