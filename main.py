#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bewa Logistics - Data Merge CLI

Main entry point for merging Monitor Sampai and Status Terupdate Excel files
into MySQL database with automatic history separation.

Usage:
    python main.py              # Run full merge process
    python main.py --init-db    # Initialize database only
    python main.py --dry-run    # Preview without saving to database
    python main.py --help       # Show help message
"""

import sys
import os
import argparse

# Fix Windows console encoding
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Add project root to path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

from config.database import DB_CONFIG
from services.merge_service import MergeService
from config.logger import setup_logger

logger = setup_logger(__name__)


def print_banner():
    """Print application banner"""
    print("""
╔═══════════════════════════════════════════════════════════╗
║           BEWA LOGISTICS - DATA MERGE SYSTEM              ║
║                                                           ║
║  Merges Monitor Sampai & Status Terupdate into MySQL      ║
║  with automatic history separation based on business rules║
╚═══════════════════════════════════════════════════════════╝
    """)


def init_db() -> bool:
    """
    Initialize MySQL database using Python mysql-connector (no CLI required).

    Returns:
        True if successful, False otherwise
    """
    logger.info("=" * 60)
    logger.info("INITIALIZING DATABASE")
    logger.info("=" * 60)

    sql_path = os.path.join(project_root, "scripts", "init_database.sql")

    if not os.path.exists(sql_path):
        logger.error(f"SQL script not found at {sql_path}")
        return False

    try:
        import mysql.connector

        # Connect without database name (we're creating it)
        config = DB_CONFIG.copy()
        del config["database"]

        logger.info(
            f"Connecting to MySQL at {DB_CONFIG['host']}:{DB_CONFIG['port']}..."
        )
        conn = mysql.connector.connect(
            host=config["host"],
            port=config["port"],
            user=config["user"],
            password=config.get("password", ""),
        )
        cursor = conn.cursor()

        # Read and execute SQL script
        logger.info(f"Reading SQL script: {sql_path}")
        with open(sql_path, "r", encoding="utf-8") as f:
            sql_script = f.read()

        # Split by semicolon and execute each statement
        statements = [s.strip() for s in sql_script.split(";") if s.strip()]

        logger.info("Executing SQL statements...")
        for i, statement in enumerate(statements):
            if statement:
                try:
                    cursor.execute(statement)
                except mysql.connector.Error as e:
                    # Ignore "database exists" and "table exists" errors
                    if e.errno not in (1007, 1050):
                        logger.warning(f"  Warning at statement {i + 1}: {e}")

        conn.commit()
        cursor.close()
        conn.close()

        logger.info("Database initialized successfully!")
        logger.info(f"  Database: {DB_CONFIG['database']}")
        logger.info("  Tables created:")
        logger.info("    - shipments (active data)")
        logger.info("    - shipments_histories (archived data)")
        return True

    except mysql.connector.Error as e:
        logger.error(f"MySQL Error: {e}")
        logger.error("  Make sure MySQL server is running.")
        return False
    except Exception as e:
        logger.error(f"Error: {e}")
        return False


def run_merge(dry_run: bool = False) -> bool:
    """
    Run the data merge process.

    Args:
        dry_run: If True, only preview without saving to database

    Returns:
        True if successful, False otherwise
    """
    logger.info("=" * 60)
    logger.info("DATA MERGE PROCESS")
    logger.info("=" * 60)

    try:
        service = MergeService(project_root)

        if dry_run:
            logger.info("[DRY RUN MODE] - No data will be saved to database")
            service.load_monitor_sampai()
            service.load_status_terupdate()
            service.merge_by_waybill()
            service._categorize_shipments()
            logger.info(service.get_report())
            logger.info("[DRY RUN] No data was saved to database.")
        else:
            # Use smart merge: only update if incoming data has newer timestamp
            service.run(clear_before=False, use_smart_merge=True)

        return True

    except FileNotFoundError as e:
        logger.error(f"Error: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return False


def show_stats() -> bool:
    """
    Show current database statistics.

    Returns:
        True if successful, False otherwise
    """
    logger.info("=" * 60)
    logger.info("DATABASE STATISTICS")
    logger.info("=" * 60)

    try:
        from config.database import get_connection, close_connection

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # Get active shipments count
        cursor.execute("SELECT COUNT(*) as count FROM shipments")
        active_count = cursor.fetchone()["count"]

        # Get history shipments count
        cursor.execute("SELECT COUNT(*) as count FROM shipments_histories")
        history_count = cursor.fetchone()["count"]

        # Get view stats
        cursor.execute("SELECT * FROM shipment_stats")
        stats = cursor.fetchall()

        cursor.close()
        close_connection(conn)

        logger.info(f"Active Shipments:  {active_count:,}")
        logger.info(f"History Shipments: {history_count:,}")
        logger.info(f"Total Records:     {active_count + history_count:,}")

        logger.info("Detailed Stats:")
        for stat in stats:
            logger.info(
                f"  {stat['table_name']}: {stat['total_records']:,} records, "
                f"{stat['unique_destinations']} destinations, "
                f"{stat['unique_scan_types']} scan types"
            )

        return True

    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        logger.error("  Make sure database is initialized and MySQL is running.")
        return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Bewa Logistics Data Merge System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py              Run full merge process
  python main.py --init-db    Initialize database only
  python main.py --dry-run    Preview merge without saving
  python main.py --stats      Show database statistics
        """,
    )

    parser.add_argument(
        "--init-db", action="store_true", help="Initialize database (create tables)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview merge results without saving to database",
    )

    parser.add_argument(
        "--stats", action="store_true", help="Show current database statistics"
    )

    args = parser.parse_args()

    print_banner()

    # Handle different modes
    if args.init_db:
        success = init_db()
    elif args.stats:
        success = show_stats()
    elif args.dry_run:
        success = run_merge(dry_run=True)
    else:
        # Default: run full merge
        logger.info("Running full merge process...")
        logger.info("Tip: Use --init-db first if database is not initialized.")
        logger.info("     Use --dry-run to preview before merging.")
        success = run_merge()

    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
