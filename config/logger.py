"""
Logging Configuration for Bewa Logistics System

Provides centralized logging setup with:
- Console output with color coding (for Windows)
- File output with rotation
- Different log levels for different components
- Structured log messages
"""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Project root for log file location
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(PROJECT_ROOT, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

# Log file path with date
LOG_FILE = os.path.join(LOG_DIR, f"bewa_{datetime.now().strftime('%Y%m%d')}.log")


class ColoredFormatter(logging.Formatter):
    """Custom formatter with color support for console output"""

    # ANSI color codes
    COLORS = {
        "DEBUG": "\033[36m",  # Cyan
        "INFO": "\033[32m",  # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
        "RESET": "\033[0m",  # Reset
    }

    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.COLORS["RESET"])
        record.levelname = f"{log_color}{record.levelname}{self.COLORS['RESET']}"
        return super().format(record)


def setup_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """
    Set up and return a logger with console and file handlers.

    Args:
        name: Logger name (usually __name__)
        level: Logging level (default: INFO)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Avoid adding handlers multiple times
    if logger.handlers:
        return logger

    # Console handler with colored output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_format = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    console_formatter = ColoredFormatter(console_format, datefmt="%H:%M:%S")
    console_handler.setFormatter(console_formatter)

    # File handler with rotation (10MB max, keep 5 backup files)
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_format = (
        "%(asctime)s | %(levelname)-8s | %(name)-20s | %(funcName)-20s | %(message)s"
    )
    file_formatter = logging.Formatter(file_format, datefmt="%Y-%m-%d %H:%M:%S")
    file_handler.setFormatter(file_formatter)

    # Add handlers to logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the specified name.

    Args:
        name: Logger name (usually __name__)

    Returns:
        Logger instance
    """
    return logging.getLogger(name)


def set_log_level(level: int):
    """
    Set logging level for all existing loggers.

    Args:
        level: Logging level (e.g., logging.DEBUG, logging.WARNING)
    """
    for name, lgr in logging.Logger.manager.loggerDict.items():
        if isinstance(lgr, logging.Logger):
            lgr.setLevel(level)
            for handler in lgr.handlers:
                handler.setLevel(level)


# Convenience function for module-level loggers
def get_module_logger() -> logging.Logger:
    """
    Get a logger for the calling module.

    Usage:
        logger = get_module_logger()

    Returns:
        Logger instance named after the calling module
    """
    import inspect

    frame = inspect.currentframe().f_back
    module_name = frame.f_globals.get("__name__", "root")
    return setup_logger(module_name)
