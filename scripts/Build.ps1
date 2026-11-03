[CmdletBinding()]
param([string]$GoExecutable = 'go')
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    if (-not (Get-Command $GoExecutable -ErrorAction SilentlyContinue)) {
        $portable = Join-Path $env:LOCALAPPDATA 'clouddrive-tools/go/bin/go.exe'
        if (Test-Path -LiteralPath $portable) { $GoExecutable = $portable } else { throw 'Go 1.26.6 is required.' }
    }
    if ((& $GoExecutable version) -notmatch 'go1\.26\.6\b') { throw 'Go 1.26.6 is required.' }
    New-Item -ItemType Directory -Force -Path dist | Out-Null
    & $GoExecutable build -trimpath -buildvcs=false -o dist/clouddrive.exe ./cmd/app
    if ($LASTEXITCODE -ne 0) { throw 'Backend production build failed.' }
    Push-Location frontend
    try { & npx --yes pnpm@10.22.0 build; if ($LASTEXITCODE -ne 0) { throw 'Frontend production build failed.' } } finally { Pop-Location }
} finally { Pop-Location }
