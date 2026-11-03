[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path (Split-Path -Parent $PSScriptRoot) 'frontend')
try {
    & npx --yes pnpm@10.22.0 install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependencies failed' }
    & npx --yes pnpm@10.22.0 exec playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw 'Browser install failed' }
    & npx --yes pnpm@10.22.0 check
    if ($LASTEXITCODE -ne 0) { throw 'Frontend checks failed' }
} finally { Pop-Location }
