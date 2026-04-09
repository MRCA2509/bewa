@echo off
chcp 65001 >nul
echo ============================================
echo Bewa Logistics - Installing Dependencies
echo ============================================
echo.

echo Installing Python dependencies...
pip install flask flask-cors

echo.
echo Installing Node.js dependencies...
cd /d "%~dp0web\frontend"
call npm install

echo.
echo ============================================
echo Installation Complete!
echo ============================================
echo.
echo To run the application:
echo   1. Start MySQL: start_mysql.bat (in project root)
echo   2. Run web server: run_web.bat
echo.
pause
