[CmdletBinding()]
param(
    [string]$BaseRef = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$args = @('run', './internal/tools/docs-guard', '--config', 'docs/documentation.yaml')
if (-not [string]::IsNullOrWhiteSpace($BaseRef)) {
    $args += @('--base', $BaseRef)
}

& go @args
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
