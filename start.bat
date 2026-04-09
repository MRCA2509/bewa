@echo off
chcp 65001 >nul
echo ============================================
echo Bewa Logistics - Quick Start
echo ============================================
echo.

REM Check if MySQL is running
sc query MySQL80 | findstr "RUNNING" >nul
if errorlevel 1 (
    echo MySQL is not running. Starting MySQL...
    cd /d "%~dp0"
    start "" "C:\Users\User\scoop\apps\mysql\current\bin\mysqld.exe" --standalone --console
    echo Waiting for MySQL to start...
    timeout /t 5 /nobreak >nul
    echo.
)

echo MySQL: Running
echo.

REM Run unified web application (Backend + Frontend in one terminal)
python "%~dp0run_dev.py"
pause
