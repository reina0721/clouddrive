[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'verify-artifacts.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Artifact validation failed' }
