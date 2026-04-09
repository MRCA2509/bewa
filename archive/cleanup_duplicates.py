#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Cleanup Script - Remove duplicate records from bewa_logistics database

Usage:
    python cleanup_duplicates.py                    # Clean and verify
    python cleanup_duplicates.py --dry-run          # Show what would be done
    python cleanup_duplicates.py --smart-merge      # Re-import with smart merge
"""

import sys
import os
import argparse

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from config.database import DB_CONFIG
from config.logger import setup_logger

logger = setup_logger(__name__)


def cleanup_database(dry_run: bool = False) -> bool:
    """
    Remove duplicate records from database.

    Args:
        dry_run: If True, only show what would be done

    Returns:
        True if successful
    """
    try:
        import mysql.connector

        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Check current state
        cursor.execute("SELECT COUNT(*) FROM shipments")
        active_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM shipments_histories")
        history_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT waybill_id) FROM shipments")
        active_unique = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT waybill_id) FROM shipments_histories")
        history_unique = cursor.fetchone()[0]

        print("\n" + "=" * 60)
        print("CURRENT DATABASE STATE")
        print("=" * 60)
        print("Active Shipments:")
        print(f"  Total records:   {active_count:,}")
        print(f"  Unique waybills: {active_unique:,}")
        if active_count > active_unique:
            print(f"  ⚠ DUPLICATES: {active_count - active_unique:,}")

        print("\nHistory Shipments:")
        print(f"  Total records:   {history_count:,}")
        print(f"  Unique waybills: {history_unique:,}")
        if history_count > history_unique:
            print(f"  ⚠ DUPLICATES: {history_count - history_unique:,}")

        total_records = active_count + history_count
        total_unique = active_unique + history_unique

        print("\nTotal:")
        print(f"  Records: {total_records:,}")
        print(f"  Unique:  {total_unique:,}")

        if total_records == total_unique:
            print("\n✅ Database is clean - no duplicates found!")
            cursor.close()
            conn.close()
            return True

        if dry_run:
            print("\n[DRY RUN] No changes made")
            print(
                f"Would truncate both tables and re-import {total_unique} unique records"
            )
            cursor.close()
            conn.close()
            return True

        # Truncate tables
        print("\n" + "=" * 60)
        print("CLEANING DATABASE")
        print("=" * 60)
        print("Truncating shipments table...")
        cursor.execute("TRUNCATE TABLE shipments")
        conn.commit()

        print("Truncating shipments_histories table...")
        cursor.execute("TRUNCATE TABLE shipments_histories")
        conn.commit()

        print("✅ Database cleaned successfully!")
        print("\nRun 'python main.py' to re-import data from Excel files")

        cursor.close()
        conn.close()
        return True

    except mysql.connector.Error as e:
        logger.error(f"MySQL Error: {e}")
        return False
    except Exception as e:
        logger.error(f"Error: {e}")
        return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Clean duplicate records from bewa_logistics database"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--smart-merge",
        action="store_true",
        help="After cleaning, re-import data using smart merge logic",
    )

    args = parser.parse_args()

    print("\n╔═══════════════════════════════════════════════════════════╗")
    print("║     BEWA LOGISTICS - DATABASE CLEANUP UTILITY             ║")
    print("╚═══════════════════════════════════════════════════════════╝\n")

    success = cleanup_database(dry_run=args.dry_run)

    if success and args.smart_merge and not args.dry_run:
        print("\n" + "=" * 60)
        print("RUNNING SMART MERGE")
        print("=" * 60)
        from services.merge_service import MergeService

        service = MergeService(project_root)
        service.run(clear_before=False, use_smart_merge=True)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
