import os
import logging
import shutil
import pandas as pd
from datetime import datetime
from typing import Dict, Any, Optional

from automation.jnt_downloader import JNTDownloader
from services.merge_service import MergeService
from config.database import get_connection, close_connection

logger = logging.getLogger(__name__)


class AutomationOrchestrator:
    """
    Coordinates downloading from JMS and importing to the Bewa Logistics database.
    """

    def __init__(self):
        self.downloader = JNTDownloader()

    def get_active_awbs(self) -> list:
        """Fetch all waybill IDs currently in the active shipments table."""
        conn = get_connection()
        if not conn:
            logger.error("Failed to connect to database to fetch active AWBs.")
            return []

        try:
            cursor = conn.cursor()
            cursor.execute("SELECT waybill_id FROM shipments")
            results = cursor.fetchall()
            return [row[0] for row in results]
        except Exception as e:
            logger.error(f"Error fetching active AWBs: {e}")
            return []
        finally:
            close_connection(conn)

    def combine_excel_files(
        self, file_paths: list, output_path: str, header_row: int = 0
    ):
        """Combine multiple Excel files into a single master file."""
        if not file_paths:
            return

        dfs = []
        for path in file_paths:
            try:
                # First, check if the file has enough rows for the requested header
                # We can't easily check row count without reading, so we try and handle error

                # Check file size as a quick heuristic
                if (
                    os.path.getsize(path) < 1000
                ):  # Very likely empty or just a separator
                    logger.warning(
                        f"File {path} is suspiciously small ({os.path.getsize(path)} bytes), skipping..."
                    )
                    continue

                df = pd.read_excel(path, header=header_row)

                # If Status Terupdate (header_row=1) and we found no data (empty df), skip
                if not df.empty:
                    dfs.append(df)
                else:
                    logger.warning(
                        f"File {path} produced an empty DataFrame with header={header_row}, skipping..."
                    )
            except ValueError as ve:
                if "Passed header" in str(ve):
                    logger.warning(
                        f"File {path} does not have enough rows for header={header_row}, skipping..."
                    )
                else:
                    logger.error(f"ValueError reading {path}: {ve}")
            except Exception as e:
                logger.error(f"Error reading {path} for combining: {e}")

        if dfs:
            combined_df = pd.concat(dfs, ignore_index=True)
            if not combined_df.empty:
                combined_df.to_excel(output_path, index=False)
                logger.info(
                    f"Successfully combined {len(dfs)} files into {output_path}"
                )
        else:
            # If nothing to combine, we don't create/overwrite the output file
            # This allows the rest of the flow to handle missing files gracefully
            logger.info("No data found in any chunks to combine.")

    def full_sync(
        self, start_date: str, end_date: Optional[str] = None, status_callback=None
    ) -> Dict[str, Any]:
        """
        Perform a full synchronization with Double-Merge Strategy:
        1. Download all Monitor Sampai chunks for the date range.
        2. Combine them into one master file.
        3. Perform a Monitory-Only merge to register new shipments.
        4. Fetch ALL active shipments (including new ones).
        5. Download Status Terupdate for those shipments.
        6. Perform the final Full Merge.
        """
        if not end_date:
            end_date = datetime.now().strftime("%Y-%m-%d")

        results = {
            "success": False,
            "monitor_sampai_files": [],
            "status_terupdate_files": [],
            "error": "",
        }

        try:
            # Establish paths
            uploads_dir = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"
            )
            os.makedirs(uploads_dir, exist_ok=True)

            # --- PHASE 1: Monitor Sampai ---
            print(
                f"LICO > [ORCHESTRATOR] TAHAP 1: Sync Monitor Sampai ({start_date} s/d {end_date})..."
            )
            ms_files = self.downloader.download_monitor_sampai(
                start_date, end_date, status_callback=status_callback
            )

            if not ms_files:
                raise Exception("Gagal mengunduh file Monitor Sampai.")

            results["monitor_sampai_files"] = ms_files

            # Combine all chunks into one file (FIX for multi-day bug)
            latest_ms_path = os.path.join(uploads_dir, "Monitor_Sampai_Auto.xlsx")
            if len(ms_files) > 1:
                if status_callback:
                    status_callback(
                        f"Tahap 1.5: Menggabungkan {len(ms_files)} file laporan..."
                    )
                self.combine_excel_files(ms_files, latest_ms_path, header_row=0)
            else:
                shutil.copy2(ms_files[0], latest_ms_path)

            # --- PHASE 2: Register New Shipments (Pre-Merge) ---
            if status_callback:
                status_callback("Tahap 2: Mendaftarkan paket baru (Monitor Only)...")

            # We need a dummy status file to satisfy MergeService requirement if it doesn't exist
            latest_st_path = os.path.join(uploads_dir, "Status_Terupdate_Auto.xlsx")
            if not os.path.exists(latest_st_path):
                # Row 0: ['-'] (separator)
                # Row 1: Columns (header)
                # We save with header=False, index=False to have exactly 2 lines
                pd.DataFrame(
                    [["-"], ["No. Waybill", "Status Terupdate", "Waktu Scan"]]
                ).to_excel(latest_st_path, index=False, header=False)

            merger = MergeService(uploads_folder=uploads_dir)
            merger.run(use_smart_merge=True)  # Run initial merge to add new AWB ids

            # --- PHASE 3: Fetch Updated Active List ---
            print(
                "LICO > [ORCHESTRATOR] TAHAP 3: Mengekstrak AWB aktif (termasuk paket baru)..."
            )
            if status_callback:
                status_callback("Tahap 3: Mengekstrak seluruh AWB aktif...")
            active_awbs = self.get_active_awbs()
            print(f"LICO > [ORCHESTRATOR] Total AWB Aktif: {len(active_awbs)}")

            # --- PHASE 4: Status Terupdate ---
            if len(active_awbs) > 0:
                print(
                    f"LICO > [ORCHESTRATOR] TAHAP 4: Sync Status Terupdate ({len(active_awbs)} AWB)..."
                )
                st_files = self.downloader.download_status_terupdate(
                    active_awbs, status_callback=status_callback
                )
                results["status_terupdate_files"] = st_files

                if st_files:
                    # Combine status chunks if multiple
                    if len(st_files) > 1:
                        self.combine_excel_files(st_files, latest_st_path, header_row=1)
                    else:
                        shutil.copy2(st_files[0], latest_st_path)

            # --- PHASE 5: Final Full Merge ---
            if status_callback:
                status_callback("Tahap 5: Sinkronisasi akhir (Full Update)...")

            merger = MergeService(uploads_folder=uploads_dir)
            merge_stats = merger.run(use_smart_merge=True)

            final_msg = f"Sinkronisasi Selesai! (+{merge_stats['active_inserted']} Active, +{merge_stats['history_inserted']} History)"
            if status_callback:
                status_callback(f"[OK] {final_msg}")
            results["success"] = True
            results["message"] = final_msg

        except Exception as e:
            logger.error(f"Orchestrator error: {e}", exc_info=True)
            results["success"] = False
            results["error"] = str(e)
            if status_callback:
                status_callback(f"[X] Gagal sinkronisasi: {e}")
        finally:
            self.downloader.close()

        return results


if __name__ == "__main__":
    # Test orchestrator
    orchestrator = AutomationOrchestrator()
    today = datetime.now().strftime("%Y-%m-%d")
    orchestrator.full_sync(
        today, today, status_callback=lambda msg: print(f"STATUS > {msg}")
    )
