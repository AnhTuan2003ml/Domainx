param([string]$OutputDirectory = "backups")
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$backupRoot = Join-Path $projectRoot $OutputDirectory
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$fileName = "domix_$stamp.dump"
$containerFile = "/tmp/$fileName"
$containerId = (docker compose ps -q database).Trim()
if (-not $containerId) { throw "Container PostgreSQL chưa chạy." }
docker compose exec -T database sh -lc "pg_dump -Fc --no-owner -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -f '$containerFile'"
if ($LASTEXITCODE -ne 0) { throw "pg_dump thất bại." }
$destination = Join-Path $backupRoot $fileName
docker cp "${containerId}:$containerFile" $destination
docker compose exec -T database rm -f $containerFile
Write-Host "Đã sao lưu: $destination"
