@echo off
chcp 65001 >nul
echo.
echo ============================================
echo Bewa Logistics - Database Reset Tool
echo ============================================
echo.
echo WARNING: This will permanently delete all data from the database.
echo.
set /p confirm="Are you sure you want to proceed? (Y/N): "
if /i "%confirm%" neq "Y" (
    echo.
    echo Operation cancelled.
    pause
    exit /b
)

echo.
echo Executing reset...
python scripts/clear_db.py

echo.
echo Press any key to exit.
pause >nul
