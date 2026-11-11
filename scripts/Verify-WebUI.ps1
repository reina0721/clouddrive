[CmdletBinding()]
param([switch]$Prepare)
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path (Split-Path -Parent $PSScriptRoot) 'frontend')
try {
    if ($Prepare) {
        & npx --yes pnpm@10.22.0 install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependencies failed' }
        & npx --yes pnpm@10.22.0 exec playwright install chromium
        if ($LASTEXITCODE -ne 0) { throw 'Browser install failed' }
    }
    if (-not (Test-Path 'node_modules')) { throw 'Missing frontend dependencies; run with -Prepare.' }
    & npx --yes pnpm@10.22.0 check
    if ($LASTEXITCODE -ne 0) { throw 'Frontend checks failed' }
} finally { Pop-Location }
