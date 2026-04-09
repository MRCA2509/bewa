"""
Merge Service - Handles loading, merging, and saving shipment data from Excel files

DEDUPLICATION LOGIC:
- Monitor Sampai: Use latest 'waktu_sampai' for duplicate waybill_id
- Status Terupdate: Use latest 'waktu_scan' for duplicate waybill_id
"""

import os
from typing import List, Dict, Tuple
from datetime import datetime

import pandas as pd

from models.shipment import Shipment
from config.database import get_connection, close_connection
from config.logger import setup_logger

logger = setup_logger(__name__)


class MergeService:
    """
    Service untuk menggabungkan data dari Monitor Sampai dan Status Terupdate,
    lalu menyimpannya ke database MySQL dengan pemisahan otomatis ke tabel histori.
    """

    def __init__(self, base_path: str = None, uploads_folder: str = None):
        """
        Initialize MergeService with path to Excel files.

        Args:
            base_path: Base directory containing the Excel files. Defaults to project root.
            uploads_folder: Folder containing uploaded files. If provided, search here first.
        """
        self.base_path = base_path or os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))
        )
        self.uploads_folder = uploads_folder or os.path.join(self.base_path, "uploads")

        # Search in uploads folder first, then base path
        self.monitor_sampai_path = self._find_file(
            ["Monitor Sampai", "monitor"], prefer_uploads=True
        )
        self.status_terupdate_path = self._find_file(
            ["Status Ter-update", "Status Terupdate", "status"], prefer_uploads=True
        )

        self.df_monitor = None
        self.df_status = None
        self.merged_shipments: List[Shipment] = []

        # Statistics
        self.stats = {
            "monitor_total": 0,
            "status_total": 0,
            "merged_total": 0,
            "active_count": 0,
            "history_count": 0,
            "matched": 0,
            "unmatched_monitor": 0,
            "unmatched_status": 0,
        }

    def _find_file(self, keywords: list, prefer_uploads: bool = False) -> str:
        """
        Find Excel file containing any of the keywords in filename.
        Searches in uploads folder first (if prefer_uploads=True), then base path.
        Returns the MOST RECENT file (by modification time) if multiple matches found.

        Args:
            keywords: List of keywords to search in filename
            prefer_uploads: If True, search in uploads folder first

        Returns:
            Full path to the found file (most recent)

        Raises:
            FileNotFoundError: If no file matching keywords is found
        """
        matches = []

        # Search in uploads folder first if preferred
        if prefer_uploads and os.path.exists(self.uploads_folder):
            for filename in os.listdir(self.uploads_folder):
                if filename.endswith(".xlsx"):
                    for keyword in keywords:
                        if keyword.lower() in filename.lower():
                            filepath = os.path.join(self.uploads_folder, filename)
                            matches.append((filepath, os.path.getmtime(filepath)))

        # Search in base path
        if not matches:  # Only search base path if nothing found in uploads
            for filename in os.listdir(self.base_path):
                if filename.endswith(".xlsx"):
                    for keyword in keywords:
                        if keyword.lower() in filename.lower():
                            filepath = os.path.join(self.base_path, filename)
                            matches.append((filepath, os.path.getmtime(filepath)))

        if not matches:
            # Fallback: search for any Excel file as last resort
            for filename in os.listdir(
                self.uploads_folder
                if prefer_uploads and os.path.exists(self.uploads_folder)
                else self.base_path
            ):
                if filename.endswith(".xlsx") and not filename.startswith("~$"):
                    filepath = os.path.join(
                        self.uploads_folder
                        if prefer_uploads and os.path.exists(self.uploads_folder)
                        else self.base_path,
                        filename,
                    )
                    matches.append((filepath, os.path.getmtime(filepath)))

        if not matches:
            raise FileNotFoundError(
                f"Cannot find Excel file containing '{keywords}' in {self.base_path} or {self.uploads_folder}"
            )

        # Return the most recent file (by modification time)
        # Filter out temporary Excel files (starting with ~$)
        matches = [m for m in matches if not os.path.basename(m[0]).startswith("~$")]
        matches.sort(key=lambda x: x[1], reverse=True)
        return matches[0][0]

    def load_monitor_sampai(self) -> pd.DataFrame:
        """
        Load Monitor Sampai Excel file (data utama).
        Deduplicates by No. Waybill, keeping the latest waktu_sampai.

        Returns:
            DataFrame containing Monitor Sampai data (deduplicated)
        """
        logger.info(f"Loading Monitor Sampai from: {self.monitor_sampai_path}")
        self.df_monitor = pd.read_excel(self.monitor_sampai_path)

        # Clean column names
        self.df_monitor.columns = [col.strip() for col in self.df_monitor.columns]

        # Normalize No. Waybill to string for consistent merging
        if "No. Waybill" in self.df_monitor.columns:
            self.df_monitor["No. Waybill"] = self.df_monitor["No. Waybill"].astype(str)

        # DEDUPLICATION: Keep latest waktu_sampai for each waybill
        if "Waktu Sampai" in self.df_monitor.columns:
            logger.info(
                "Deduplicating Monitor Sampai by No. Waybill (keeping latest waktu_sampai)..."
            )
            # Sort by Waktu Sampai descending, then keep first occurrence of each waybill
            self.df_monitor = self.df_monitor.sort_values(
                "Waktu Sampai", ascending=False
            )
            self.df_monitor = self.df_monitor.drop_duplicates(
                subset="No. Waybill", keep="first"
            )
            logger.info(f"  After deduplication: {len(self.df_monitor)} records")

        self.stats["monitor_total"] = len(self.df_monitor)
        logger.info(
            f"  Loaded {self.stats['monitor_total']} records from Monitor Sampai"
        )
        return self.df_monitor

    def load_status_terupdate(self) -> pd.DataFrame:
        """
        Load Status Terupdate Excel file (data pelengkap).
        Deduplicates by No. Waybill, keeping the latest waktu_scan.

        Returns:
            DataFrame containing Status Terupdate data (deduplicated)
        """
        logger.info(f"Loading Status Terupdate from: {self.status_terupdate_path}")

        # The actual headers are in row 1 (index 1), row 0 has '-' separator
        # Load with header=1 to use the second row as column names
        self.df_status = pd.read_excel(self.status_terupdate_path, header=1)

        # Clean column names - strip whitespace
        self.df_status.columns = [str(col).strip() for col in self.df_status.columns]

        # Remove any columns that are still 'Unnamed' or empty
        valid_cols = []
        for col in self.df_status.columns:
            if col and not col.startswith("Unnamed") and col != "-":
                valid_cols.append(col)

        self.df_status = self.df_status[valid_cols]

        # Normalize No. Waybill to string for consistent merging
        if "No. Waybill" in self.df_status.columns:
            self.df_status["No. Waybill"] = self.df_status["No. Waybill"].astype(str)

        # DEDUPLICATION: Keep latest waktu_scan for each waybill
        if "Waktu Scan" in self.df_status.columns:
            logger.info(
                "Deduplicating Status Terupdate by No. Waybill (keeping latest waktu_scan)..."
            )
            # Sort by Waktu Scan descending, then keep first occurrence of each waybill
            self.df_status = self.df_status.sort_values("Waktu Scan", ascending=False)
            self.df_status = self.df_status.drop_duplicates(
                subset="No. Waybill", keep="first"
            )
            logger.info(f"  After deduplication: {len(self.df_status)} records")

        # Mark these records as having been synchronized now
        self.df_status["last_status_sync_at"] = datetime.now()

        self.stats["status_total"] = len(self.df_status)
        logger.info(
            f"  Loaded {self.stats['status_total']} records from Status Terupdate"
        )
        logger.info(
            f"  Columns: {self.df_status.columns.tolist()[:10]}..."
        )  # Show first 10 columns
        return self.df_status

    def merge_by_waybill(self) -> List[Shipment]:
        """
        Merge Monitor Sampai and Status Terupdate by No. Waybill using LEFT JOIN.
        Monitor Sampai is the primary table (left), Status Terupdate is supplementary (right).

        Returns:
            List of Shipment objects with merged data
        """
        if self.df_monitor is None:
            self.load_monitor_sampai()
        if self.df_status is None:
            self.load_status_terupdate()

        logger.info("\nMerging data by No. Waybill (LEFT JOIN)...")

        # Perform LEFT JOIN: Monitor Sampai (left) + Status Terupdate (right)
        merged_df = pd.merge(
            self.df_monitor,
            self.df_status,
            on="No. Waybill",
            how="left",
            suffixes=("", "_status"),
        )

        # Calculate match statistics
        matched_waybills = set(self.df_monitor["No. Waybill"].astype(str)) & set(
            self.df_status["No. Waybill"].astype(str)
        )
        self.stats["matched"] = len(matched_waybills)
        self.stats["unmatched_monitor"] = len(self.df_monitor) - len(matched_waybills)

        # Convert merged DataFrame to list of Shipment objects
        self.merged_shipments = []
        for _, row in merged_df.iterrows():
            data = row.to_dict()
            # Map merged columns (with suffixes) to Shipment model expected names
            # Priority: Monitor Sampai (no suffix) > Status Terupdate (_status suffix)
            mapped_data = {}

            # Primary key
            mapped_data["No. Waybill"] = data.get("No. Waybill")

            # Monitor Sampai columns (no suffix) - these have priority
            mapped_data["DP Outgoing"] = data.get("DP Outgoing")
            mapped_data["Tujuan"] = data.get("Tujuan")
            mapped_data["Jenis Layanan"] = data.get("Jenis Layanan")
            mapped_data["Sumber Order"] = data.get("Sumber Order")
            mapped_data["Berat Ditagih"] = data.get("Berat Ditagih")
            mapped_data["Drop Point"] = data.get("Drop Point")
            mapped_data["Waktu Sampai"] = data.get("Waktu Sampai")
            mapped_data["Lokasi Sebelumnya"] = data.get("Lokasi Sebelumnya")
            mapped_data["Discan oleh"] = data.get("Discan oleh")

            # Status Terupdate columns (fallback to _status suffixed versions)
            mapped_data["No Order"] = data.get("No Order") or data.get(
                "No Order_status"
            )
            mapped_data["Diinput oleh"] = data.get("Diinput oleh") or data.get(
                "Diinput oleh_status"
            )
            mapped_data["Waktu Input"] = data.get("Waktu Input") or data.get(
                "Waktu Input_status"
            )
            mapped_data["Penerima"] = data.get("Penerima") or data.get(
                "Penerima_status"
            )
            mapped_data["Waktu TTD"] = data.get("Waktu TTD") or data.get(
                "Waktu TTD_status"
            )
            mapped_data["Waktu Regis Retur"] = data.get(
                "Waktu Regis Retur"
            ) or data.get("Waktu Regis Retur_status")
            mapped_data["Agent Outgoing"] = data.get("Agent Outgoing") or data.get(
                "Agent Outgoing_status"
            )
            mapped_data["Tanggal Pengiriman"] = data.get(
                "Tanggal Pengiriman"
            ) or data.get("Tanggal Pengiriman_status")
            mapped_data["Agent Tujuan"] = data.get("Agent Tujuan") or data.get(
                "Agent Tujuan_status"
            )
            mapped_data["Provinsi Tujuan"] = data.get("Provinsi Tujuan") or data.get(
                "Provinsi Tujuan_status"
            )
            mapped_data["Kota Tujuan"] = data.get("Kota Tujuan") or data.get(
                "Kota Tujuan_status"
            )
            mapped_data["NLC"] = data.get("NLC") or data.get("NLC_status")
            mapped_data["DP NLC"] = data.get("DP NLC") or data.get("DP NLC_status")
            mapped_data["Biaya COD"] = data.get("Biaya COD") or data.get(
                "Biaya COD_status"
            )
            mapped_data["total DFOD"] = data.get("total DFOD") or data.get(
                "total DFOD_status"
            )
            mapped_data["Tipe Pembayaran"] = data.get("Tipe Pembayaran") or data.get(
                "Tipe Pembayaran_status"
            )
            mapped_data["Status Asuransi"] = data.get("Status Asuransi") or data.get(
                "Status Asuransi_status"
            )
            mapped_data["End Status"] = data.get("End Status") or data.get(
                "End Status_status"
            )
            mapped_data["Keterangan"] = data.get("Keterangan") or data.get(
                "Keterangan_status"
            )
            mapped_data["Station Scan"] = data.get("Station Scan") or data.get(
                "Station Scan_status"
            )
            mapped_data["Jenis Scan"] = data.get("Jenis Scan") or data.get(
                "Jenis Scan_status"
            )
            mapped_data["Waktu Scan"] = data.get("Waktu Scan") or data.get(
                "Waktu Scan_status"
            )
            mapped_data["Discan Oleh"] = data.get("Discan Oleh") or data.get(
                "Discan Oleh_status"
            )
            mapped_data["Sprinter PU atau Delivery"] = data.get(
                "Sprinter PU atau Delivery"
            ) or data.get("Sprinter PU atau Delivery_status")
            mapped_data["Agent Scan"] = data.get("Agent Scan") or data.get(
                "Agent Scan_status"
            )
            mapped_data["Nomor Bagging"] = data.get("Nomor Bagging") or data.get(
                "Nomor Bagging_status"
            )
            mapped_data["Alasan Masalah/Tinggal Gudang"] = data.get(
                "Alasan Masalah/Tinggal Gudang"
            ) or data.get("Alasan Masalah/Tinggal Gudang_status")
            mapped_data["Lokasi Sebelumnya / Berikutnya"] = data.get(
                "Lokasi Sebelumnya / Berikutnya"
            ) or data.get("Lokasi Sebelumnya / Berikutnya_status")
            mapped_data["last_status_sync_at"] = data.get("last_status_sync_at_status")

            shipment = Shipment(mapped_data)
            if shipment.waybill_id:  # Only add if waybill_id exists
                self.merged_shipments.append(shipment)

        self.stats["merged_total"] = len(self.merged_shipments)
        logger.info(f"  Merged {self.stats['merged_total']} total shipments")
        logger.info(f"  Matched waybills: {self.stats['matched']}")
        logger.info(
            f"  Unmatched (Monitor Sampai only): {self.stats['unmatched_monitor']}"
        )

        return self.merged_shipments

    def _categorize_shipments(self) -> Tuple[List[Shipment], List[Shipment]]:
        """
        Categorize shipments into active and history based on business rules.

        Returns:
            Tuple of (active_shipments, history_shipments)
        """
        active = []
        history = []

        for shipment in self.merged_shipments:
            if shipment.is_history():
                history.append(shipment)
            else:
                active.append(shipment)

        self.stats["active_count"] = len(active)
        self.stats["history_count"] = len(history)

        logger.info("\nCategorization:")
        logger.info(f"  Active shipments: {self.stats['active_count']}")
        logger.info(f"  History shipments: {self.stats['history_count']}")

        return active, history

    def save_to_database(
        self, clear_before: bool = False, use_smart_merge: bool = True
    ) -> Dict[str, int]:
        """
        Save merged shipments to MySQL database.
        Active shipments go to 'shipments' table.
        History shipments go to 'shipments_histories' table.

        Args:
            clear_before: If True, clear existing data before inserting (REPLACE mode)
            use_smart_merge: If True, only update if incoming data has newer timestamp

        Returns:
            Dictionary with counts of inserted records
        """
        if not self.merged_shipments:
            self.merge_by_waybill()

        active_shipments, history_shipments = self._categorize_shipments()

        conn = None
        cursor = None
        result = {"active_inserted": 0, "history_inserted": 0}

        try:
            conn = get_connection()
            cursor = conn.cursor()

            # Clear existing data if requested
            if clear_before:
                logger.info("Clearing existing data before merge (REPLACE mode)...")
                cursor.execute("TRUNCATE TABLE shipments")
                cursor.execute("TRUNCATE TABLE shipments_histories")
                conn.commit()

            # Insert active shipments
            if active_shipments:
                logger.info(f"Inserting {len(active_shipments)} active shipments...")
                result["active_inserted"] = self._insert_shipments_smart(
                    cursor,
                    active_shipments,
                    is_history=False,
                    use_smart_merge=use_smart_merge,
                )
                conn.commit()
                logger.info(
                    f"  Successfully inserted {result['active_inserted']} active shipments"
                )

            # Insert history shipments
            if history_shipments:
                logger.info(f"Inserting {len(history_shipments)} history shipments...")
                result["history_inserted"] = self._insert_shipments_smart(
                    cursor,
                    history_shipments,
                    is_history=True,
                    use_smart_merge=use_smart_merge,
                )
                conn.commit()
                logger.info(
                    f"  Successfully inserted {result['history_inserted']} history shipments"
                )

            return result

        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Error saving to database: {e}", exc_info=True)
            raise
        finally:
            if cursor:
                cursor.close()
            if conn:
                close_connection(conn)

    def _insert_shipments_smart(
        self,
        cursor,
        shipments: List[Shipment],
        is_history: bool = False,
        use_smart_merge: bool = True,
    ) -> int:
        """
        Insert list of shipments with smart deduplication logic.

        SMART MERGE LOGIC:
        - Monitor Sampai: Compare 'waktu_sampai' - keep latest
        - Status Terupdate: Compare 'waktu_scan' - keep latest
        - If existing record has newer timestamp, skip update
        - If incoming record has newer timestamp, update record

        Args:
            cursor: Database cursor
            shipments: List of Shipment objects to insert
            is_history: If True, insert into shipments_histories table
            use_smart_merge: If True, compare timestamps before updating

        Returns:
            Number of successfully inserted/updated records
        """
        table_name = "shipments_histories" if is_history else "shipments"

        # Column names for insertion (must match DB schema)
        columns = [
            "waybill_id",
            "dp_outgoing",
            "tujuan",
            "jenis_layanan",
            "sumber_order",
            "berat_ditagih",
            "drop_point",
            "waktu_sampai",
            "lokasi_sebelumnya",
            "discan_oleh",
            "no_order",
            "diinput_oleh",
            "waktu_input",
            "penerima",
            "waktu_ttd",
            "waktu_regis_retur",
            "waktu_konfirmasi_retur",
            "agent_outgoing",
            "tanggal_pengiriman",
            "agent_tujuan",
            "provinsi_tujuan",
            "kota_tujuan",
            "nlc",
            "dp_nlc",
            "biaya_cod",
            "total_dfod",
            "tipe_pembayaran",
            "status_asuransi",
            "end_status",
            "keterangan",
            "station_scan",
            "jenis_scan",
            "waktu_scan",
            "discan_oleh_scan",
            "sprinter",
            "agent_scan",
            "nomor_bagging",
            "alasan_masalah",
            "lokasi_berikutnya",
            "last_status_sync_at",
            # Retur columns - must be included to prevent silent data loss on merge
            "dp_register_retur",
            "waktu_tolak",
            "dp_tolak",
            "alasan_penolakan",
            "status_void",
            "waktu_void",
            "dp_void_retur",
        ]

        if is_history:
            columns.extend(["archived_at", "archive_reason"])

        placeholders = ", ".join(["%s"] * len(columns))
        column_names = ", ".join(columns)

        inserted_count = 0
        skipped_count = 0
        updated_count = 0
        now = datetime.now()

        # PERFORMANCE OPTIMIZATION (Batch lookup existing records)
        existing_lookup = {}
        if use_smart_merge and shipments:
            # Collect all waybill IDs in this batch
            all_ids = [s.waybill_id for s in shipments if s.waybill_id]
            if all_ids:
                # Fetch all timestamps in ONE query instead of N queries
                id_placeholders = ", ".join(["%s"] * len(all_ids))
                lookup_sql = f"SELECT waybill_id, waktu_sampai, waktu_scan FROM {table_name} WHERE waybill_id IN ({id_placeholders})"
                cursor.execute(lookup_sql, all_ids)
                for row in cursor.fetchall():
                    existing_lookup[row[0]] = (
                        row[1],
                        row[2],
                    )  # {waybill_id: (waktu_sampai, waktu_scan)}

        for shipment in shipments:
            try:
                data = shipment.to_dict()
                waybill_id = data.get("waybill_id")

                if not waybill_id:
                    continue

                if use_smart_merge:
                    # Check if record exists in the pre-fetched lookup table
                    existing = existing_lookup.get(waybill_id)

                    if existing:
                        # Determine which timestamp to compare
                        # For active: compare waktu_sampai
                        # For history: compare waktu_scan
                        existing_time = existing[0] if not is_history else existing[1]
                        incoming_time = (
                            data.get("waktu_sampai")
                            if not is_history
                            else data.get("waktu_scan")
                        )

                        # Skip if incoming data is older or same
                        if incoming_time and existing_time:
                            if incoming_time <= existing_time:
                                skipped_count += 1
                                continue
                            else:
                                updated_count += 1
                        elif existing_time and not incoming_time:
                            skipped_count += 1
                            continue

                values = [
                    data.get("waybill_id"),
                    data.get("dp_outgoing"),
                    data.get("tujuan"),
                    data.get("jenis_layanan"),
                    data.get("sumber_order"),
                    data.get("berat_ditagih"),
                    data.get("drop_point"),
                    data.get("waktu_sampai"),
                    data.get("lokasi_sebelumnya"),
                    data.get("discan_oleh"),
                    data.get("no_order"),
                    data.get("diinput_oleh"),
                    data.get("waktu_input"),
                    data.get("penerima"),
                    data.get("waktu_ttd"),
                    data.get("waktu_regis_retur"),
                    data.get("waktu_konfirmasi_retur"),
                    data.get("agent_outgoing"),
                    data.get("tanggal_pengiriman"),
                    data.get("agent_tujuan"),
                    data.get("provinsi_tujuan"),
                    data.get("kota_tujuan"),
                    data.get("nlc"),
                    data.get("dp_nlc"),
                    data.get("biaya_cod"),
                    data.get("total_dfod"),
                    data.get("tipe_pembayaran"),
                    data.get("status_asuransi"),
                    data.get("end_status"),
                    data.get("keterangan"),
                    data.get("station_scan"),
                    data.get("jenis_scan"),
                    data.get("waktu_scan"),
                    data.get("discan_oleh_scan"),
                    data.get("sprinter"),
                    data.get("agent_scan"),
                    data.get("nomor_bagging"),
                    data.get("alasan_masalah"),
                    data.get("lokasi_berikutnya"),
                    data.get("last_status_sync_at"),
                    # Retur columns (preserve existing data by using COALESCE in ON DUPLICATE)
                    data.get("dp_register_retur"),
                    data.get("waktu_tolak"),
                    data.get("dp_tolak"),
                    data.get("alasan_penolakan"),
                    data.get("status_void"),
                    data.get("waktu_void"),
                    data.get("dp_void_retur"),
                ]

                if is_history:
                    values.extend([now, shipment.get_archive_reason()])

                # Use INSERT ... ON DUPLICATE KEY UPDATE to preserve created_at and
                # keep existing retur data if incoming is NULL
                update_parts = []
                for col in columns:
                    if col == "waybill_id":
                        continue  # Primary key, don't update
                    # For retur columns: only update if incoming value is not NULL
                    if col in (
                        "dp_register_retur",
                        "waktu_tolak",
                        "dp_tolak",
                        "alasan_penolakan",
                        "status_void",
                        "waktu_void",
                        "dp_void_retur",
                        "waktu_konfirmasi_retur",
                    ):
                        update_parts.append(f"{col} = COALESCE(VALUES({col}), {col})")
                    else:
                        update_parts.append(f"{col} = VALUES({col})")

                if is_history:
                    update_parts.append("archived_at = VALUES(archived_at)")
                    update_parts.append("archive_reason = VALUES(archive_reason)")

                update_clause = ", ".join(update_parts)

                upsert_sql = f"""
                    INSERT INTO {table_name} ({column_names})
                    VALUES ({placeholders})
                    ON DUPLICATE KEY UPDATE {update_clause}
                """
                cursor.execute(upsert_sql, values)
                inserted_count += 1

            except Exception as e:
                logger.error(
                    f"  Error inserting/replacing waybill {shipment.waybill_id}: {e}"
                )

        logger.info(
            f"  Inserted: {inserted_count}, Updated: {updated_count}, Skipped (older/existing): {skipped_count}"
        )

        if skipped_count > 0:
            logger.info(
                f"  ℹ️ Skipped {skipped_count} records because existing data has same or newer timestamp"
            )
            logger.info(
                "     To force update, delete records from database first or upload files with newer timestamps"
            )

        return inserted_count

    def get_report(self) -> str:
        """
        Generate merge report.

        Returns:
            Formatted report string
        """
        report = []
        report.append("=" * 60)
        report.append("MERGE REPORT - Bewa Logistics Database")
        report.append("=" * 60)
        report.append(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        report.append("SOURCE DATA:")
        report.append(f"  Monitor Sampai records:    {self.stats['monitor_total']}")
        report.append(f"  Status Terupdate records:  {self.stats['status_total']}")
        report.append("")
        report.append("MERGE RESULTS:")
        report.append(f"  Matched waybills:          {self.stats['matched']}")
        report.append(f"  Unmatched (Monitor only):  {self.stats['unmatched_monitor']}")
        report.append(f"  Total merged:              {self.stats['merged_total']}")
        report.append("")
        report.append("CATEGORIZATION (History Rules - OR Logic):")
        report.append(f"  Active shipments:          {self.stats['active_count']}")
        report.append(f"  History shipments:         {self.stats['history_count']}")
        report.append("")
        report.append("HISTORY RULES:")
        report.append("  1. jenis_scan IN ('Scan TTD', 'Scan TTD Retur')")
        report.append("  2. station_scan NOT IN ('MABA', 'BULI', 'WASILE', 'SOFIFI',")
        report.append(
            "                        'LABUHA', 'FALAJAWA2', 'SANANA', 'BOBONG')"
        )
        report.append("  3. jenis_scan != 'Scan Pickup'")
        report.append("")
        report.append("=" * 60)

        return "\n".join(report)

    def run(
        self, clear_before: bool = False, use_smart_merge: bool = True
    ) -> Dict[str, int]:
        """
        Run the complete merge process: load, merge, save.

        Args:
            clear_before: If True, clear existing data before inserting (default: False)
            use_smart_merge: If True, only update if incoming data has newer timestamp (default: True)

        Returns:
            Dictionary with insertion counts
        """
        logger.info("=" * 60)
        logger.info("BEWA LOGISTICS - DATA MERGE PROCESS")
        logger.info("=" * 60)

        self.load_monitor_sampai()
        self.load_status_terupdate()

        # Validate both files are loaded
        if self.df_monitor is None or self.df_status is None:
            logger.error(
                "ERROR: Both Monitor Sampai and Status Terupdate files are required!"
            )
            logger.error("  Please upload both Excel files before running merge.")
            return {"active_inserted": 0, "history_inserted": 0}

        self.merge_by_waybill()
        result = self.save_to_database(
            clear_before=clear_before, use_smart_merge=use_smart_merge
        )

        logger.info(self.get_report())

        return result
