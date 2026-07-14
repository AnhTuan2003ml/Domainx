@echo off
setlocal

set "HOST=0.0.0.0"
set "PORT=8000"
set "APP_DIR=%~dp0"

echo.
echo ================================
echo   DOMIX - start frontend/backend
echo ================================
echo.

echo [1/5] Chuyen den thu muc chua run.bat...
cd /d "%APP_DIR%"
if errorlevel 1 (
  echo [ERROR] Khong cd duoc vao thu muc: "%APP_DIR%"
  pause
  exit /b 1
)
echo Thu muc hien tai: %CD%
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay python trong PATH.
  echo Hay cai Python va tick "Add Python to PATH", sau do chay lai run.bat.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Khong tim thay npm.cmd trong PATH.
  echo Hay cai Node.js truoc khi chay file nay.
  pause
  exit /b 1
)

echo [2/5] Cai Python dependencies...
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] pip install -r requirements.txt that bai.
  pause
  exit /b 1
)

echo.
echo [3/5] Kiem tra/cai frontend dependencies...
if not exist "node_modules" (
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] npm install that bai.
    pause
    exit /b 1
  )
) else (
  echo node_modules da ton tai, bo qua npm install.
)

echo.
echo [4/5] Build frontend React/Vite vao thu muc dist...
call npm.cmd run build
if errorlevel 1 (
  echo [ERROR] Build frontend that bai.
  pause
  exit /b 1
)

echo.
echo [5/5] Chay Python backend va serve luon frontend da build...
echo.
echo Mo tren may nay:      http://127.0.0.1:%PORT%
echo Mo tu may khac LAN:   http://IP_MAY_CHU:%PORT%
echo Tai khoan mac dinh neu DB moi: admin@gmail.com / admin123@
echo.
echo Nhan Ctrl+C de dung server.
echo.

python backend\server.py --host %HOST% --port %PORT%

echo.
echo Server da dung.
pause
