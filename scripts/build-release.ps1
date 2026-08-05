param(
    [Parameter(Mandatory = $false)]
    [string]$Output = ''
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if (-not $Output) { $Output = Join-Path $root 'Domix.zip' }
$outputPath = [System.IO.Path]::GetFullPath($Output)
if ([System.IO.Path]::GetDirectoryName($outputPath) -ne $root) {
    throw 'Release archive must be created directly in the project root.'
}

$excludedDirectories = @(
    '.git', '.codegraph', '.claude', '.codex', '.agents', '.idea', '.vscode',
    'node_modules', 'dist', 'data', '__pycache__', 'backups', 'logs', 'uploads',
    'tmp', 'temp', '.venv', 'venv', 'env', '.pytest_cache', '.mypy_cache', '.ruff_cache'
)
$excludedFilePatterns = @(
    '*.pyc', '*.pyo', '*.sqlite', '*.sqlite3', '*.sqlite3-*', '*.db', '*.db-*',
    '*.log', '*.dump', '*.bak', '*.zip', '.env', '.env.*', '*.pem', '*.key', '*.p12', '*.pfx'
)

$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("domix-release-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    function Copy-ReleaseTree([string]$Source, [string]$Destination) {
        foreach ($item in Get-ChildItem -LiteralPath $Source -Force) {
            if ($item.PSIsContainer) {
                if ($item.Name -in $excludedDirectories) { continue }
                $childDestination = Join-Path $Destination $item.Name
                New-Item -ItemType Directory -Path $childDestination -Force | Out-Null
                Copy-ReleaseTree -Source $item.FullName -Destination $childDestination
                continue
            }
            $skip = $false
            if ($item.Name -ne '.env.example') {
                foreach ($pattern in $excludedFilePatterns) {
                    if ($item.Name -like $pattern) { $skip = $true; break }
                }
            }
            if (-not $skip) {
                Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $Destination $item.Name)
            }
        }
    }
    Copy-ReleaseTree -Source $root -Destination $stage

    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $outputPath -CompressionLevel Optimal
    & (Join-Path $PSScriptRoot 'verify-release.ps1') -Archive $outputPath
}
finally {
    if ((Test-Path -LiteralPath $stage) -and $stage.StartsWith([System.IO.Path]::GetTempPath(), [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $stage -Recurse -Force
    }
}
