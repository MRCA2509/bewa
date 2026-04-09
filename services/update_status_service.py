"""
Update Status Service
Handles parsing of a single "Status Terupdate" file and updating existing records in the database.
If updated records meet the "End Status" criteria, they are moved to the history table.
"""

import pandas as pd
from datetime import datetime

from models.shipment import Shipment
from config.database import get_connection, close_connection
from config.logger import setup_logger

logger = setup_logger(__name__)


class UpdateStatusService:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.df_status = None
        self.stats = {
            "total_in_file": 0,
            "updated_active": 0,
            "moved_to_history": 0,
            "skipped_not_active": 0,
            "skipped_older_time": 0,
        }

    def process(self):
        logger.info("=" * 60)
        logger.info("BEWA LOGISTICS - STANDALONE STATUS UPDATE")
        logger.info("=" * 60)
        logger.info(f"Loading Status Terupdate from: {self.file_path}")

        try:
            # The actual headers are in row 1 (index 1), row 0 has '-'
            self.df_status = pd.read_excel(self.file_path, header=1)
            self.df_status.columns = [
                str(col).strip() for col in self.df_status.columns
            ]

            # Remove dummy columns
            valid_cols = [
                c
                for c in self.df_status.columns
                if c and not c.startswith("Unnamed") and c != "-"
            ]
            self.df_status = self.df_status[valid_cols]

            if "No. Waybill" not in self.df_status.columns:
                raise ValueError("Kolom 'No. Waybill' tidak ditemukan dalam file excel")

            self.df_status["No. Waybill"] = self.df_status["No. Waybill"].astype(str)

            if "Waktu Scan" in self.df_status.columns:
                self.df_status = self.df_status.sort_values(
                    "Waktu Scan", ascending=False
                )
                self.df_status = self.df_status.drop_duplicates(
                    subset="No. Waybill", keep="first"
                )

            self.stats["total_in_file"] = len(self.df_status)
            logger.info(
                f"  Loaded {self.stats['total_in_file']} deduplicated records from file"
            )

            self._update_database()

            logger.info("STATUS UPDATE REPORT")
            logger.info(f"  Total In File: {self.stats['total_in_file']}")
            logger.info(f"  Updated (Still Active): {self.stats['updated_active']}")
            logger.info(f"  Moved to History: {self.stats['moved_to_history']}")
            logger.info(
                f"  Skipped (Not found/Old/Offline): {self.stats['skipped_older_time']} | Not active: {self.stats['skipped_not_active']}"
            )
            logger.info("=" * 60)

            return {"success": True, "stats": self.stats}

        except Exception as e:
            logger.error(f"Error processing status update: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def _update_database(self):
        conn = get_connection()
        if not conn:
            raise Exception("Database connection failed")

        cursor = None
        try:
            cursor = conn.cursor(dictionary=True)
            now = datetime.now()

            for _, row in self.df_status.iterrows():
                waybill = row.get("No. Waybill")
                if not waybill:
                    continue

                # Fetch existing record from active shipments
                cursor.execute(
                    "SELECT * FROM shipments WHERE waybill_id = %s", (waybill,)
                )
                existing = cursor.fetchone()

                if not existing:
                    self.stats["skipped_not_active"] += 1
                    continue

                existing_scan = existing.get("waktu_scan")
                incoming_scan = row.get("Waktu Scan")

                # Compare timestamps properly using datetime objects
                if existing_scan and incoming_scan:
                    # Ensure both are datetime objects for safe comparison
                    def to_datetime(val):
                        if isinstance(val, datetime):
                            return val
                        if pd.notna(val):
                            try:
                                return pd.Timestamp(val).to_pydatetime()
                            except Exception:
                                pass
                        return None

                    existing_dt = to_datetime(existing_scan)
                    incoming_dt = to_datetime(incoming_scan)

                    if existing_dt and incoming_dt:
                        if incoming_dt <= existing_dt:
                            self.stats["skipped_older_time"] += 1
                            continue
                    elif existing_dt and not incoming_dt:
                        # Existing has a valid timestamp but incoming doesn't, skip
                        self.stats["skipped_older_time"] += 1
                        continue

                # Build update mapped data
                db_cols = {
                    "no_order": "No Order",
                    "diinput_oleh": "Diinput oleh",
                    "waktu_input": "Waktu Input",
                    "penerima": "Penerima",
                    "waktu_ttd": "Waktu TTD",
                    "waktu_regis_retur": "Waktu Regis Retur",
                    "agent_outgoing": "Agent Outgoing",
                    "tanggal_pengiriman": "Tanggal Pengiriman",
                    "agent_tujuan": "Agent Tujuan",
                    "provinsi_tujuan": "Provinsi Tujuan",
                    "kota_tujuan": "Kota Tujuan",
                    "nlc": "NLC",
                    "dp_nlc": "DP NLC",
                    "biaya_cod": "Biaya COD",
                    "total_dfod": "total DFOD",
                    "tipe_pembayaran": "Tipe Pembayaran",
                    "status_asuransi": "Status Asuransi",
                    "end_status": "End Status",
                    "keterangan": "Keterangan",
                    "station_scan": "Station Scan",
                    "jenis_scan": "Jenis Scan",
                    "waktu_scan": "Waktu Scan",
                    "discan_oleh_scan": "Discan Oleh",
                    "sprinter": "Sprinter PU atau Delivery",
                    "agent_scan": "Agent Scan",
                    "nomor_bagging": "Nomor Bagging",
                    "alasan_masalah": "Alasan Masalah/Tinggal Gudang",
                    "lokasi_berikutnya": "Lokasi Sebelumnya / Berikutnya",
                }

                updates = []
                values = []
                combined = dict(existing)

                for db_col, file_col in db_cols.items():
                    if file_col in row and not pd.isna(row[file_col]):
                        updates.append(f"{db_col} = %s")
                        val = (
                            str(row[file_col])
                            if not isinstance(row[file_col], (int, float))
                            else row[file_col]
                        )
                        values.append(val)
                        combined[db_col] = row[file_col]

                updates.append("last_status_sync_at = %s")
                values.append(now)
                combined["last_status_sync_at"] = now

                if not updates:
                    continue

                test_shipment = Shipment(combined)

                if test_shipment.is_history():
                    # Move to history
                    # We ensure we have exactly matched columns for shipments_histories
                    columns = list(existing.keys())  # Start with all shipments columns

                    combined["archived_at"] = now
                    combined["archive_reason"] = test_shipment.get_archive_reason()

                    if "archived_at" not in columns:
                        columns.append("archived_at")
                    if "archive_reason" not in columns:
                        columns.append("archive_reason")

                    placeholders = ", ".join(["%s"] * len(columns))
                    cols_str = ", ".join(columns)
                    vals = [combined.get(col) for col in columns]

                    cursor.execute(
                        f"REPLACE INTO shipments_histories ({cols_str}) VALUES ({placeholders})",
                        vals,
                    )
                    cursor.execute(
                        "DELETE FROM shipments WHERE waybill_id = %s", (waybill,)
                    )
                    self.stats["moved_to_history"] += 1
                else:
                    # Update active shipment
                    update_sql = f"UPDATE shipments SET {', '.join(updates)} WHERE waybill_id = %s"
                    values.append(waybill)
                    cursor.execute(update_sql, values)
                    self.stats["updated_active"] += 1

            conn.commit()

        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if cursor:
                cursor.close()
            if conn:
                close_connection(conn)
