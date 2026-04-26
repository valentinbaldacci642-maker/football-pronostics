@echo off
title PronoStats - Football Intelligence

echo [PronoStats] Starting backend...
start "Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /noisy > nul

echo [PronoStats] Starting frontend...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo [PronoStats] Application starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo Health: http://localhost:5000/health
echo.
