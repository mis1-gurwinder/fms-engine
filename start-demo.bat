@echo off
start "FMS API" cmd /k "cd /d %~dp0server && npm install && npm run dev"
timeout /t 3 /nobreak >nul
start "FMS Frontend" cmd /k "cd /d %~dp0client && npm install && npm run dev"
echo.
echo FMS Engine demo is starting.
echo Frontend: http://localhost:5173
pause
