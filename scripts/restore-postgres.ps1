param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$resolved = (Resolve-Path $BackupFile).Path
$containerId = (docker compose ps -q database).Trim()
if (-not $containerId) { throw "Container PostgreSQL chưa chạy." }
$containerFile = "/tmp/domix_restore.dump"
docker cp $resolved "${containerId}:$containerFile"
docker compose exec -T database sh -lc "pg_restore --clean --if-exists --no-owner -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" '$containerFile'"
if ($LASTEXITCODE -ne 0) { throw "Khôi phục database thất bại." }
docker compose exec -T database rm -f $containerFile
docker compose restart backend
Write-Host "Đã khôi phục database từ: $resolved"
