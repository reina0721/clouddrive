[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    & go run ./internal/tools/docs-guard --config docs/documentation.yaml
    if ($LASTEXITCODE -ne 0) { throw 'Documentation validation failed' }
} finally { Pop-Location }
