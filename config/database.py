"""
Database configuration and connection helper for MySQL
"""

import mysql.connector
from mysql.connector import pooling
import os
from config.logger import setup_logger

logger = setup_logger(__name__)

# MySQL Connection Configuration (Scoop default settings)
# Scoop MySQL uses default: root with blank password
# MySQL Connection Configuration
DB_CONFIG = {
    "host": os.environ.get("MYSQL_HOST", "localhost"),
    "port": int(os.environ.get("MYSQL_PORT", 3306)),
    "user": os.environ.get("MYSQL_USER", "root"),
    "password": os.environ.get("MYSQL_PASSWORD", ""),
    "database": os.environ.get("MYSQL_DATABASE", "bewa_logistics"),
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci",
    "autocommit": True,
}

# Connection Pool Configuration
POOL_CONFIG = {"pool_name": "bewa_pool", "pool_size": 5, "pool_reset_session": True}

# Global connection pool
_connection_pool = None


def get_connection_pool():
    """Get or create the connection pool"""
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = pooling.MySQLConnectionPool(
            pool_name=POOL_CONFIG["pool_name"],
            pool_size=POOL_CONFIG["pool_size"],
            pool_reset_session=POOL_CONFIG["pool_reset_session"],
            **DB_CONFIG,
        )
    return _connection_pool


def get_connection():
    """Get a connection from the pool"""
    try:
        pool = get_connection_pool()
        return pool.get_connection()
    except mysql.connector.Error as err:
        logger.error(f"Error getting connection from pool: {err}")
        # Fallback: create direct connection
        logger.warning("Falling back to direct connection")
        return mysql.connector.connect(**DB_CONFIG)


def close_connection(conn):
    """Close the connection (return to pool)"""
    if conn and conn.is_connected():
        conn.close()


