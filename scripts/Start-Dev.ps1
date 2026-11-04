[CmdletBinding()]
param([string]$GoExecutable = 'go', [switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$previousSetupToken = $env:APP_IAM__LOCAL__SETUPTOKEN
Push-Location $repo
try {
    if (Test-Path -LiteralPath '.data/dev-processes.json') { throw 'Run scripts/Stop-Dev.ps1 before starting again.' }
    foreach ($port in @(4173,8080,9090)) {
        if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port is already in use. Stop its service before starting clouddrive." }
    }
    if (-not (Get-Command $GoExecutable -ErrorAction SilentlyContinue)) {
        $portable = Join-Path $env:LOCALAPPDATA 'clouddrive-tools/go1.26.10/go/bin/go.exe'
        if (Test-Path -LiteralPath $portable) { $GoExecutable = $portable } else { throw 'Go 1.26.10 is required. Pass -GoExecutable with its path.' }
    }
    if ((& $GoExecutable version) -notmatch 'go1\.26\.10\b') { throw 'Go 1.26.10 is required.' }
    New-Item -ItemType Directory -Force -Path '.data', '.tools' | Out-Null
    if (-not (Test-Path -LiteralPath 'config.yaml')) { Copy-Item -LiteralPath 'config.example.yaml' -Destination 'config.yaml' }
    if (-not $previousSetupToken) {
        if (-not (Test-Path -LiteralPath '.data/dev-setup-token')) {
            $bytes = New-Object byte[] 32
            $random = [Security.Cryptography.RandomNumberGenerator]::Create()
            try { $random.GetBytes($bytes) } finally { $random.Dispose() }
            [Convert]::ToBase64String($bytes) | Set-Content -LiteralPath '.data/dev-setup-token'
        }
        $env:APP_IAM__LOCAL__SETUPTOKEN = (Get-Content -LiteralPath '.data/dev-setup-token' -Raw).Trim()
    }
    & $GoExecutable build -o .tools/clouddrive-dev.exe ./cmd/app
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
    & ./.tools/clouddrive-dev.exe db migrate up
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
    if (-not $SkipInstall) {
        Push-Location frontend
        try { & npx --yes pnpm@10.22.0 install --frozen-lockfile; if ($LASTEXITCODE -ne 0) { throw 'Frontend install failed.' } } finally { Pop-Location }
    }
    $backend = Start-Process -FilePath (Join-Path $repo '.tools/clouddrive-dev.exe') -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $repo '.data/backend.log') -RedirectStandardError (Join-Path $repo '.data/backend-error.log')
    # Explicit environment for the child only; restore the caller's environment afterwards.
    $names = @('NEXT_PUBLIC_AUTH_MODE','NEXT_PUBLIC_AUTH_API_BASE_URL','CLOUDDRIVE_BACKEND_URL')
    $previous = @{}; foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name) }
    try {
        $env:NEXT_PUBLIC_AUTH_MODE = 'backend'
        $env:NEXT_PUBLIC_AUTH_API_BASE_URL = '/api/console/v1'
        $env:CLOUDDRIVE_BACKEND_URL = 'http://127.0.0.1:8080'
        $command = "Set-Location -LiteralPath '" + $repo.Replace("'", "''") + "/frontend'; & npx --yes pnpm@10.22.0 dev; exit `$LASTEXITCODE"
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
        $frontend = Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile','-EncodedCommand',$encoded) -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $repo '.data/frontend.log') -RedirectStandardError (Join-Path $repo '.data/frontend-error.log')
    } catch { Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue; throw } finally {
        foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$previous[$name]) }
    }
    @($backend,$frontend) | ForEach-Object { @{ id=$_.Id; started=$_.StartTime.ToUniversalTime().ToString('o') } } | ConvertTo-Json | Set-Content -LiteralPath '.data/dev-processes.json'
    try {
        foreach ($url in @('http://127.0.0.1:8080/api/console/v1/auth/registration-policy','http://127.0.0.1:4173/login')) {
            $deadline = [DateTime]::UtcNow.AddSeconds(90)
            $ready = $false
            do {
                if ($backend.HasExited -or $frontend.HasExited) { throw 'A development process exited. Check .data/*-error.log.' }
                try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5; $ready = $response.StatusCode -eq 200 } catch { Start-Sleep -Milliseconds 300 }
            } while (-not $ready -and [DateTime]::UtcNow -lt $deadline)
            if (-not $ready) { throw "Startup timed out: $url. Check .data logs." }
        }
    } catch { & (Join-Path $PSScriptRoot 'Stop-Dev.ps1'); throw }
    Write-Host 'clouddrive: http://127.0.0.1:4173  |  first administrator: /setup'
    Write-Host 'Logs: .data/backend.log, .data/frontend.log. Stop: scripts/Stop-Dev.ps1'
    if (-not $previousSetupToken) { Write-Host 'First administrator setup token: .data/dev-setup-token (keep private).' }
} finally { $env:APP_IAM__LOCAL__SETUPTOKEN = $previousSetupToken; Pop-Location }
