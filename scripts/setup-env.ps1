param(
  [Parameter(Mandatory = $true)]
  [string]$AdminEmail,
  [int]$HttpPort = 8080,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"

if ((Test-Path $envPath) -and -not $Force) {
  throw "File .env đã tồn tại. Dùng -Force nếu muốn tạo lại."
}

function New-SecureToken([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  return [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+','A').Replace('/','B')
}

$dbPassword = New-SecureToken 30
$adminPassword = New-SecureToken 24
$otpSecret = New-SecureToken 48

$content = @"
POSTGRES_DB=domix
POSTGRES_USER=domix
POSTGRES_PASSWORD=$dbPassword
DOMIX_ADMIN_EMAIL=$AdminEmail
DOMIX_ADMIN_PASSWORD=$adminPassword
DOMIX_OTP_SECRET=$otpSecret
DOMIX_HTTP_PORT=$HttpPort
DOMIX_CORS_ORIGIN=*
DOMIX_SMTP_HOST=smtp.gmail.com
DOMIX_SMTP_PORT=465
DOMIX_SMTP_EMAIL=
DOMIX_SMTP_APP_PASSWORD=
DOMIX_ANTHROPIC_API_KEY=
DOMIX_ANTHROPIC_MODEL=claude-sonnet-4-6
DOMIX_AI_TIMEOUT_SECONDS=120
"@

[System.IO.File]::WriteAllText($envPath, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Đã tạo $envPath"
Write-Host "Tài khoản quản trị: $AdminEmail"
Write-Host "Mật khẩu quản trị: $adminPassword"
Write-Host "Hãy lưu mật khẩu vào trình quản lý mật khẩu an toàn."
