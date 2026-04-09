"""
Data Validation Script - Verifies Excel data is correctly loaded and merged
"""

import sys
import os
from datetime import datetime

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from services.merge_service import MergeService
from config.logger import setup_logger

logger = setup_logger(__name__)


def validate_data():
    """Run comprehensive data validation"""
    print("=" * 80)
    print("DATA VALIDATION REPORT")
    print("=" * 80)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    service = MergeService(project_root)

    # Load data
    print("\n" + "=" * 80)
    print("STEP 1: Loading Excel Files")
    print("=" * 80)
    service.load_monitor_sampai()
    service.load_status_terupdate()

    # Validate Monitor Sampai
    print("\n" + "=" * 80)
    print("STEP 2: Monitor Sampai Validation")
    print("=" * 80)
    expected_monitor_cols = [
        "No. Waybill",
        "DP Outgoing",
        "Tujuan",
        "Jenis Layanan",
        "Sumber Order",
        "Berat Ditagih",
        "Drop Point",
        "Waktu Sampai",
        "Lokasi Sebelumnya",
        "Discan oleh",
    ]
    actual_cols = list(service.df_monitor.columns)
    missing_cols = set(expected_monitor_cols) - set(actual_cols)
    if missing_cols:
        print(f"  ⚠ MISSING COLUMNS: {missing_cols}")
    else:
        print(f"  ✓ All {len(expected_monitor_cols)} expected columns present")
    print(f"  ✓ Total records: {len(service.df_monitor)}")

    # Validate Status Terupdate
    print("\n" + "=" * 80)
    print("STEP 3: Status Terupdate Validation")
    print("=" * 80)
    critical_status_cols = [
        "No. Waybill",
        "Station Scan",
        "Jenis Scan",
        "Waktu Scan",
        "Discan Oleh",
        "Agent Scan",
        "Keterangan",
        "No Order",
        "Diinput oleh",
        "Penerima",
        "Waktu TTD",
    ]
    actual_status_cols = list(service.df_status.columns)
    missing_status = set(critical_status_cols) - set(actual_status_cols)
    if missing_status:
        print(f"  ⚠ MISSING COLUMNS: {missing_status}")
    else:
        print(f"  ✓ All {len(critical_status_cols)} critical columns present")
    print(f"  ✓ Total records: {len(service.df_status)}")

    # Merge data
    print("\n" + "=" * 80)
    print("STEP 4: Merging Data")
    print("=" * 80)
    shipments = service.merge_by_waybill()

    # Validate merge results
    print("\n  Merge Statistics:")
    print(f"    - Total merged: {service.stats['merged_total']}")
    print(f"    - Matched waybills: {service.stats['matched']}")
    print(f"    - Unmatched (Monitor only): {service.stats['unmatched_monitor']}")

    if service.stats["matched"] == len(service.df_monitor):
        print("  ✓ All Monitor Sampai records matched with Status Terupdate")
    else:
        matched_pct = (service.stats["matched"] / len(service.df_monitor)) * 100
        print(f"  ⚠ Only {matched_pct:.1f}% records matched")

    # Validate data completeness
    print("\n" + "=" * 80)
    print("STEP 5: Data Completeness Check")
    print("=" * 80)

    critical_fields = {
        "waybill_id": "Waybill ID",
        "tujuan": "Tujuan",
        "station_scan": "Station Scan",
        "jenis_scan": "Jenis Scan",
        "waktu_scan": "Waktu Scan",
        "dp_outgoing": "DP Outgoing",
        "drop_point": "Drop Point",
    }

    all_valid = True
    for field, label in critical_fields.items():
        empty_count = sum(1 for s in shipments if not getattr(s, field, None))
        if empty_count > 0:
            print(f"  ⚠ {label}: {empty_count} empty values")
            all_valid = False
        else:
            print(f"  ✓ {label}: All {len(shipments)} records have values")

    # Validate Status Terupdate fields
    print("\n" + "=" * 80)
    print("STEP 6: Status Terupdate Data Check")
    print("=" * 80)

    status_fields = {
        "no_order": "No Order",
        "diinput_oleh": "Diinput Oleh",
        "penerima": "Penerima",
        "waktu_ttd": "Waktu TTD",
        "agent_outgoing": "Agent Outgoing",
        "agent_tujuan": "Agent Tujuan",
        "nlc": "NLC",
        "keterangan": "Keterangan",
    }

    for field, label in status_fields.items():
        non_empty = sum(1 for s in shipments if getattr(s, field, None))
        pct = (non_empty / len(shipments)) * 100
        if pct >= 90:
            print(f"  ✓ {label}: {non_empty}/{len(shipments)} ({pct:.1f}%)")
        elif pct >= 50:
            print(f"  ~ {label}: {non_empty}/{len(shipments)} ({pct:.1f}%) - PARTIAL")
        else:
            print(f"  ⚠ {label}: {non_empty}/{len(shipments)} ({pct:.1f}%) - LOW")

    # Validate history categorization
    print("\n" + "=" * 80)
    print("STEP 7: History Categorization")
    print("=" * 80)

    active_count = sum(1 for s in shipments if not s.is_history())
    history_count = sum(1 for s in shipments if s.is_history())

    print(f"  Active shipments: {active_count}")
    print(f"  History shipments: {history_count}")

    # Sample history reasons
    history_samples = [s for s in shipments if s.is_history()][:3]
    if history_samples:
        print("\n  Sample history reasons:")
        for s in history_samples:
            print(f"    - {s.waybill_id}: {s.get_archive_reason()[:60]}...")

    # Final summary
    print("\n" + "=" * 80)
    print("VALIDATION SUMMARY")
    print("=" * 80)

    if all_valid and service.stats["matched"] == len(service.df_monitor):
        print("  ✓ ALL VALIDATIONS PASSED")
        print("  ✓ Data from Excel files is correctly loaded and merged")
        print("  ✓ Ready for database insertion")
    else:
        print("  ⚠ SOME VALIDATIONS FAILED")
        print("  Review warnings above before proceeding")

    print("\n" + "=" * 80)

    return all_valid


if __name__ == "__main__":
    success = validate_data()
    sys.exit(0 if success else 1)
