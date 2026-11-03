[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$layoutScript = Join-Path $repositoryRoot 'scripts\project-layout.mjs'
$toolDirectory = (& node $layoutScript --field toolsRoot).Trim()
$releaseDirectory = (& node $layoutScript --field releaseRoot).Trim()
if ([string]::IsNullOrWhiteSpace($toolDirectory) -or [string]::IsNullOrWhiteSpace($releaseDirectory)) { throw 'layout did not provide release paths' }
$previousPath = $env:PATH
$previousPassword = $env:COSIGN_PASSWORD
$previousSyftUpdateCheck = $env:SYFT_CHECK_FOR_APP_UPDATE
$previousGoReleaserDist = $env:GORELEASER_DIST
Push-Location $repositoryRoot
try {
    $env:PATH = "$toolDirectory;$env:PATH"
    $env:SYFT_CHECK_FOR_APP_UPDATE = 'false'
    foreach ($tool in @('goreleaser', 'syft', 'cosign')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "Missing $tool; run scripts/Install-Tools.ps1 first"
        }
    }

    $env:GORELEASER_DIST = $releaseDirectory
    goreleaser release --snapshot --clean '--skip=sign,publish,announce'
    if ($LASTEXITCODE -ne 0) { throw 'GoReleaser snapshot failed' }

    $temporaryKeyDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("clouddrive-cosign-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $temporaryKeyDirectory | Out-Null
    try {
        $random = [byte[]]::new(32)
        [System.Security.Cryptography.RandomNumberGenerator]::Fill($random)
        $env:COSIGN_PASSWORD = [Convert]::ToHexString($random)
        $keyPrefix = Join-Path $temporaryKeyDirectory 'local-rc'
        cosign generate-key-pair --output-key-prefix $keyPrefix | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Cosign temporary key generation failed' }
        cosign sign-blob --yes --tlog-upload=false --key "$keyPrefix.key" --bundle (Join-Path $releaseDirectory 'checksums.txt.bundle') --output-signature (Join-Path $releaseDirectory 'checksums.txt.sig') (Join-Path $releaseDirectory 'checksums.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Cosign checksum signing failed' }
        Copy-Item -LiteralPath "$keyPrefix.pub" -Destination (Join-Path $releaseDirectory 'local-rc.pub')
        cosign verify-blob --insecure-ignore-tlog --key (Join-Path $releaseDirectory 'local-rc.pub') --bundle (Join-Path $releaseDirectory 'checksums.txt.bundle') --signature (Join-Path $releaseDirectory 'checksums.txt.sig') (Join-Path $releaseDirectory 'checksums.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Cosign checksum verification failed' }
    } finally {
        if (Test-Path -LiteralPath $temporaryKeyDirectory) {
            $resolvedKeyDirectory = (Resolve-Path -LiteralPath $temporaryKeyDirectory -ErrorAction Stop).Path
            $resolvedTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\')
            $expectedPrefix = $resolvedTempRoot + '\clouddrive-cosign-'
            if (-not $resolvedKeyDirectory.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Refusing to remove unexpected temporary directory: $resolvedKeyDirectory"
            }
            Remove-Item -LiteralPath $resolvedKeyDirectory -Recurse -Force -ErrorAction Stop
        }
    }

    Push-Location $releaseDirectory
    try {
        foreach ($line in Get-Content -LiteralPath checksums.txt -Encoding utf8) {
            if ($line -notmatch '^([0-9a-f]{64})\s+(.+)$') { throw "Invalid checksum line: $line" }
            $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Matches[2]).Hash.ToLowerInvariant()
            if ($actual -ne $Matches[1]) { throw "Checksum mismatch: $($Matches[2])" }
        }
    } finally {
        Pop-Location
    }
} finally {
    $env:PATH = $previousPath
    $env:COSIGN_PASSWORD = $previousPassword
    $env:SYFT_CHECK_FOR_APP_UPDATE = $previousSyftUpdateCheck
    $env:GORELEASER_DIST = $previousGoReleaserDist
    Pop-Location
}

