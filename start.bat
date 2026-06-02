@echo off
echo [AI CRM] Starting backend (3001) and frontend (3000)...

:: 기존 프로세스 정리
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 "') do taskkill /F /PID %%a >nul 2>&1

npm run dev
