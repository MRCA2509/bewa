@echo off
chcp 65001 >nul
echo ============================================
echo Bewa Logistics - Web Server Launcher
echo ============================================
echo.

cd /d "%~dp0"

echo Starting Flask backend server...
echo Backend: http://localhost:5000
echo.

start "Bewa Logistics Backend" cmd /k "python server.py"

timeout /t 3 /nobreak >nul

echo Starting React frontend (dev mode)...
echo Frontend: http://localhost:5173
echo.

cd frontend
start "Bewa Logistics Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo Bewa Logistics Web Application Started!
echo ============================================
echo.
echo Backend API: http://localhost:5000
echo Frontend UI: http://localhost:5173
echo.
echo Press Ctrl+C in each window to stop servers.
echo.
pause
