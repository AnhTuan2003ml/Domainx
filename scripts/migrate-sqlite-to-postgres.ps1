param(
  [Parameter(Mandatory = $true)]
  [string]$SqliteFile,
  [switch]$Replace
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$resolved = (Resolve-Path $SqliteFile).Path
$mount = "${resolved}:/migration/domix.sqlite3:ro"
docker compose up -d database
$argsList = @("compose", "run", "--rm", "--no-deps", "-v", $mount, "backend", "python", "backend/scripts/migrate_sqlite_to_postgres.py", "--sqlite", "/migration/domix.sqlite3")
if ($Replace) { $argsList += "--replace" }
& docker @argsList
if ($LASTEXITCODE -ne 0) { throw "Chuyển dữ liệu SQLite sang PostgreSQL thất bại." }
docker compose up -d backend web
Write-Host "Đã chuyển dữ liệu và khởi động lại DOMIX."
