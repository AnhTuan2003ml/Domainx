param(
    [Parameter(Mandatory = $false)]
    [string]$Archive = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $Archive) { $Archive = Join-Path $projectRoot 'Domix.zip' }
$archivePath = [System.IO.Path]::GetFullPath($Archive)
if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    throw "Release archive not found: $archivePath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $entries = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    $forbidden = @(
        '(^|/)node_modules(/|$)',
        '(^|/)__pycache__(/|$)',
        '(^|/)data(/|$)',
        '(^|/).*\.sqlite3?(?:-|$)',
        '(^|/).*\.db(?:-|$)',
        '(^|/)\.env(?:\.|$)',
        '(^|/).*\.py[co]$',
        '(^|/)(dist|\.git|\.codegraph|backups)(/|$)'
    )
    $violations = @($entries | Where-Object {
        $entry = $_
        if ($entry -eq '.env.example') { return $false }
        return [bool]($forbidden | Where-Object { $entry -match $_ })
    } | Sort-Object -Unique)
    if ($violations.Count -gt 0) {
        throw "Release archive contains forbidden files:`n$($violations -join "`n")"
    }

    $required = @('.env.example', 'README.md', 'package.json', 'docker-compose.yml', 'docker-compose.test.yml')
    $missing = @($required | Where-Object { $_ -notin $entries })
    if ($missing.Count -gt 0) {
        throw "Release archive is missing required files: $($missing -join ', ')"
    }
    Write-Output "PASS release archive: $($entries.Count) entries; no SQLite, node_modules, __pycache__, data, or secret .env."
}
finally {
    $zip.Dispose()
}
