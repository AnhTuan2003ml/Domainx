@echo off
setlocal EnableExtensions

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"
if errorlevel 1 (
  echo [LOI] Khong mo duoc thu muc du an: %APP_DIR%
  pause
  exit /b 1
)

echo.
echo ==========================================
echo   DOMIX - PostgreSQL duy nhat qua Docker
echo ==========================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay Docker Desktop.
  echo Hay cai/mo Docker Desktop roi chay lai run.bat.
  pause
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo [LOI] Docker Compose khong san sang.
  echo Hay cap nhat Docker Desktop roi chay lai.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [LOI] Docker Desktop chua khoi dong xong.
  echo Mo Docker Desktop, cho den khi Engine Running roi chay lai.
  pause
  exit /b 1
)

echo [1/3] Dung backend cu neu dang chay...
docker compose down --remove-orphans
if errorlevel 1 goto :failed

echo.
echo [2/3] Build va khoi dong DOMIX voi PostgreSQL duy nhat...
docker compose up -d --build
if errorlevel 1 goto :failed

echo.
echo [3/3] Kiem tra trang thai container...
docker compose ps

echo.
echo DOMIX dang chay tai: http://127.0.0.1:8848
echo Database duy nhat: volume Docker domix_postgres_data
echo File data\domix.sqlite3 cu (neu con) se KHONG duoc doc hoac ghi.
echo.
echo Xem log backend: docker compose logs -f backend
echo Dung he thong:     docker compose down
echo.
pause
exit /b 0

:failed
echo.
echo [LOI] Khong khoi dong duoc DOMIX. Dang in log gan nhat...
docker compose logs --tail 120
pause
exit /b 1
