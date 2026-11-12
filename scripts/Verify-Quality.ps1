[CmdletBinding()]
param([string]$GoExecutable = 'go')

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot
try {
    node --test scripts/verify-go-format.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Go formatting verifier tests failed' }
    node scripts/verify-go-format.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Go source formatting failed' }
    & $GoExecutable mod tidy -diff
    if ($LASTEXITCODE -ne 0) { throw 'go mod tidy -diff failed' }
    & $GoExecutable run ./internal/tools/project-layout --check-identity
    if ($LASTEXITCODE -ne 0) { throw 'project layout identity check failed' }
    & $GoExecutable run ./internal/tools/project-layout --check-webui
    if ($LASTEXITCODE -ne 0) { throw 'project layout webui consistency check failed' }
    & $GoExecutable generate ./...
    if ($LASTEXITCODE -ne 0) { throw 'go generate failed' }
    $openapi = (& node scripts/project-layout.mjs --field openapiOutput).Trim()
    $operationInventory = (& node scripts/project-layout.mjs --field operationInventoryOutput).Trim()
    git diff --exit-code -- $openapi $operationInventory frontend/apps/web/src/generated/native-openapi.json
    if ($LASTEXITCODE -ne 0) { throw 'generated files are not clean' }
    & $GoExecutable test ./... -count=1
    if ($LASTEXITCODE -ne 0) { throw 'go test failed' }
    & $GoExecutable test -race ./... -count=1
    if ($LASTEXITCODE -ne 0) { throw 'go test -race failed' }
    & $GoExecutable vet ./...
    if ($LASTEXITCODE -ne 0) { throw 'go vet failed' }
    $previousCGO = $env:CGO_ENABLED
    try {
        $env:CGO_ENABLED = '0'
        & $GoExecutable build -trimpath -buildvcs=false ./...
        if ($LASTEXITCODE -ne 0) { throw 'CGO-free build failed' }
    } finally {
        $env:CGO_ENABLED = $previousCGO
    }
    & (Join-Path $PSScriptRoot 'Verify-Artifacts.ps1')
} finally {
    Pop-Location
}
