# Logging System

This project uses a centralized logging system for all components.

## Features

- **Console Output**: Colored log messages for easy reading
- **File Output**: Automatic log rotation (10MB max, 5 backup files)
- **Structured Format**: Timestamp, level, module, function, and message
- **Daily Log Files**: New log file created each day

## Log Location

Logs are stored in: `logs/bewa_YYYYMMDD.log`

## Log Levels

- `DEBUG`: Detailed debugging information
- `INFO`: General operational messages
- `WARNING`: Warning messages (something unexpected happened)
- `ERROR`: Error messages (function failed)
- `CRITICAL`: Critical errors (application may not continue)

## Usage

### In Python Modules

```python
from config.logger import setup_logger

logger = setup_logger(__name__)

# Log messages
logger.debug("Debugging info")
logger.info("Processing started")
logger.warning("Something unexpected happened")
logger.error("An error occurred")
logger.critical("Critical failure")

# Log with exception traceback
try:
    risky_operation()
except Exception as e:
    logger.error(f"Operation failed: {e}", exc_info=True)
```

### Changing Log Level

```python
from config.logger import set_log_level
import logging

# Set all loggers to DEBUG
set_log_level(logging.DEBUG)

# Set all loggers to WARNING (only warnings and above)
set_log_level(logging.WARNING)
```

## Log Format

### Console Output
```
14:30:45 | INFO     | merge_service | Loading Monitor Sampai from: ...
14:30:46 | ERROR    | database      | Connection failed: Access denied
```

### File Output
```
2026-03-29 14:30:45 | INFO     | merge_service      | _load_monitor_sampai   | Loading Monitor Sampai from: ...
2026-03-29 14:30:46 | ERROR    | database           | get_connection         | Connection failed: Access denied
```

## Components Using Logging

- `config/database.py` - Database connection events
- `services/merge_service.py` - Merge process steps
- `web/server.py` - API requests and errors
- `main.py` - CLI operations

## Viewing Logs

### Real-time (PowerShell)
```powershell
Get-Content logs\bewa_*.log -Wait -Tail 50
```

### Real-time (Command Prompt)
```batch
type logs\bewa_*.log
```

### Latest errors only
```powershell
Get-Content logs\bewa_*.log | Select-String "ERROR|CRITICAL"
```
