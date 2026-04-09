from config.database import get_connection

conn = get_connection()
cur = conn.cursor()

try:
    cur.execute(
        "ALTER TABLE shipments ADD COLUMN waktu_regis_retur DATETIME AFTER waktu_ttd"
    )
    print("✅ shipments: column added")
except Exception as e:
    if "Duplicate" in str(e):
        print("⚠️ shipments: column already exists")
    else:
        print(f"❌ shipments: {e}")

try:
    cur.execute(
        "ALTER TABLE shipments_histories ADD COLUMN waktu_regis_retur DATETIME AFTER waktu_ttd"
    )
    print("✅ shipments_histories: column added")
except Exception as e:
    if "Duplicate" in str(e):
        print("⚠️ shipments_histories: column already exists")
    else:
        print(f"❌ shipments_histories: {e}")

conn.commit()
conn.close()
print("\n✅ Database schema updated!")
